
import React, { useState, useMemo } from 'react';
import { db } from '../services/db';
import {
  FileUp, CheckCircle2, AlertCircle, Sparkles,
  Loader2, Table, ListChecks, ArrowRight,
  Settings2, FileSpreadsheet, Trash2, PackageSearch, Clock, Download
} from 'lucide-react';
import { MovementType, Product, Category, AuditLog } from '../types';
import ManageCategoriesModal from './ManageCategoriesModal';
import * as XLSX from 'xlsx';

type ImportStatus = 'idle' | 'selecting-source' | 'mapping' | 'preview' | 'importing' | 'success' | 'error';
type ImportTarget = 'products' | 'movements';

interface DataSource {
  id: string;
  name: string;
  count: number;
  type: 'sheet' | 'xml-table' | 'nfe';
}

const ImportExport = ({ user }: any) => {
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [target, setTarget] = useState<ImportTarget>('products');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [report, setReport] = useState({ total: 0, valid: 0, invalid: 0, duplicates: 0 });
  const [errorMessage, setErrorMessage] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  // Category State
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Multi-source selection state
  const [availableSources, setAvailableSources] = useState<DataSource[]>([]);
  const [cachedBuffer, setCachedBuffer] = useState<ArrayBuffer | null>(null);
  const [cachedFile, setCachedFile] = useState<File | null>(null);

  // History State
  const [importedSourceIds, setImportedSourceIds] = useState<string[]>([]);
  const [currentSourceId, setCurrentSourceId] = useState<string | null>(null);
  const [importHistory, setImportHistory] = useState<AuditLog[]>([]);

  const loadCategories = async () => {
    const cats = await db.getCategories();
    setCategories(cats);
  };

  const loadHistory = async () => {
    const h = await db.getImportHistory();
    setImportHistory(h);
  };

  React.useEffect(() => {
    loadCategories();
    loadHistory();
  }, []);

  const handleCategoryChange = (newCategory?: Category) => {
    loadCategories();
    if (newCategory) {
      setSelectedCategoryId(newCategory.id);
    }
  };

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // Campos obrigatórios do sistema
  const systemFields = {
    products: [
      { id: 'cod', label: 'Código do Item (CÓD)', required: true },
      { id: 'description', label: 'Descrição/Nome', required: true },
      { id: 'unit', label: 'Unidade (U, FD, KG)', required: false },
      { id: 'minStock', label: 'Estoque Mínimo', required: false },
      // { id: 'pmed', label: 'Custo Médio (PMED)', required: false }, // Removido conforme solicitado
      { id: 'storageLocation', label: 'Localização', required: false }
    ],
    movements: [
      { id: 'movementDate', label: 'Data do Lançamento', required: true },
      { id: 'cod', label: 'Código do Item', required: true },
      { id: 'quantity', label: 'Quantidade', required: true },
      { id: 'type', label: 'Tipo (Entrada/Saída)', required: true },
      { id: 'totalValue', label: 'Valor Total', required: false },
      { id: 'invoiceNumber', label: 'Número da NF', required: false },
      { id: 'destination', label: 'Destino/Setor', required: false }
    ]
  };

  // --- Funções de Análise e Normalização ---
  const analyzeSpreadsheet = (rawMatrix: any[][]): { headerRowIndex: number, headers: string[] } => {
    addLog("Iniciando análise estrutural da planilha...");
    try {
      // 1. Busca por linha de cabeçalho baseada em pontuação (Interpretação)
      let bestRowIndex = 0;
      let maxScore = -999; // Começa baixo para evitar falsos positivos

      const strongKeywords = ['codigo', 'cod', 'sku', 'ean', 'descricao', 'produto', 'nome', 'item', 'quantidade', 'qtd', 'valor', 'total', 'preco'];
      const commonHeaders = [
        // Produtos
        'codigo', 'cod', 'ref', 'ean', 'sku', 'id',
        'descricao', 'produto', 'nome', 'item', 'desc', 'embalagens', 'embalagem', 'especificacao',
        'unidade', 'und', 'un', 'medida', 'u.m.',
        'minimo', 'seguranca', 'demand', 'estoque min',
        'custo', 'valor', 'preco', 'total', 'vlr', 'pmed', 'unitario',
        'local', 'localizacao', 'deposito', 'origem', 'destino', 'almoxarifado',
        // Movimentos
        'quantidade', 'qtd', 'estoque', 'saldo', 'qde', 'qde1', 'quant',
        'data', 'dt', 'movimento', 'lancamento', 'emissao',
        'tipo', 'operacao', 'e/s', 'mov',
        'nf', 'nota', 'documento', 'doc', 'cupom'
      ];

      // Limita a busca às primeiras 50 linhas para performance
      const limit = Math.min(rawMatrix.length, 50);

      for (let i = 0; i < limit; i++) {
        const row = rawMatrix[i];
        if (!row || !Array.isArray(row)) continue;

        let score = 0;
        let nonEmptyCount = 0;
        let textCount = 0;
        let numberCount = 0;
        let dateLikeCount = 0;
        let keywordMatches = 0;
        let filterArtifacts = 0;

        row.forEach(cell => {
          if (cell !== undefined && cell !== null && String(cell).trim() !== '') {
            nonEmptyCount++;
            const valStr = String(cell).trim();
            const valLower = valStr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            // Verifica artefatos de filtro/tabela dinâmica
            if (valLower === '(tudo)' || valLower === '(all)' || valLower === 'total geral' || valLower === 'grand total') {
              filterArtifacts++;
            }

            // Análise de Tipo de Conteúdo
            const isNumber = !isNaN(Number(valStr.replace(',', '.'))) && valStr !== '';
            const isDate = /^\d{2}\/\d{2}\/\d{4}$/.test(valStr) || /^\d{4}-\d{2}-\d{2}$/.test(valStr);

            if (isNumber) numberCount++;
            else if (isDate) dateLikeCount++;
            else textCount++;

            // Pontuação por palavra-chave
            if (commonHeaders.some(h => valLower === h || valLower.includes(h))) {
              score += 10;
              keywordMatches++;
            }
            // Bônus para palavras-chave FORTES (colunas essenciais)
            if (strongKeywords.some(k => valLower === k || valLower === k + 's')) { // plural check simple
              score += 15;
            }
          }
        });

        // PENALIDADES SEVERAS
        // Se tiver artefatos de filtro ("(Tudo)"), mata a pontuação dessa linha
        if (filterArtifacts > 0) {
          score -= 1000;
        }

        // Heurísticas de Cabeçalho:
        // 1. Cabeçalhos são majoritariamente texto
        if (textCount > numberCount) score += 5;

        // 2. Linhas de dados geralmente têm muitos números ou datas (não queremos elas como header)
        if (numberCount > textCount || dateLikeCount > 0) score -= 20;

        // 3. Linhas com poucas colunas preenchidas provavelmente são títulos ou lixo
        if (nonEmptyCount < 2) score -= 10;

        // 4. Se não tem NENHUMA palavra-chave, é improvável ser o header
        if (keywordMatches === 0) score -= 5;

        // Preferência por linhas com mais colunas preenchidas e com palavras-chave
        if (score > maxScore) {
          maxScore = score;
          bestRowIndex = i;
        }
      }

      // Fallback: Se nenhuma linha pontuar bem (>0), tenta encontrar a primeira linha com > 3 colunas de texto
      // Mas só se o maxScore for muito ruim (negativo ou zero)
      if (maxScore <= 0) {
        addLog("Nenhuma linha de cabeçalho óbvia encontrada (Score baixo). Tentando heurística secundária...");
        for (let i = 0; i < limit; i++) {
          const row = rawMatrix[i];
          if (!row) continue;
          const cols = row.filter((c: any) => c && String(c).trim() !== '').length;
          const textCols = row.filter((c: any) => c && isNaN(Number(c))).length;

          // Verifica se tem artefatos proibidos
          const hasArtifacts = row.some((c: any) => {
            const s = String(c).toLowerCase();
            return s.includes('(tudo)') || s.includes('(all)');
          });

          if (!hasArtifacts && cols > 2 && textCols > cols / 2) {
            bestRowIndex = i;
            addLog(`Fallback: Usando linha ${i + 1} por ter conteúdo textual majoritário.`);
            break;
          }
        }
      }

      addLog(`Cabeçalho detectado na linha ${bestRowIndex + 1} (Score: ${maxScore})`);
      const headers = rawMatrix[bestRowIndex] ? rawMatrix[bestRowIndex].map(cell => String(cell || '').trim()) : [];

      // Verifica se o header detectado tem duplicatas (comum em linhas de dados, raro em headers)
      const uniqueHeaders = new Set(headers.filter(h => h));
      if (uniqueHeaders.size < headers.filter(h => h).length / 2) {
        addLog("ALERTA: O cabeçalho detectado parece ter muitos valores repetidos. Pode ser uma linha de dados.");
      }

      return { headerRowIndex: bestRowIndex, headers };
    } catch (err: any) {
      console.error("Erro na análise da planilha:", err);
      addLog(`Erro na análise: ${err.message}. Usando primeira linha como cabeçalho.`);
      // Fallback supremo: assume primeira linha
      return { headerRowIndex: 0, headers: rawMatrix[0]?.map(c => String(c)) || [] };
    }
  };

  // --- Analisador de Estrutura de Arquivo (Detecta Tabelas/Abas) ---
  const analyzeFileStructure = (file: File, buffer: ArrayBuffer): DataSource[] => {
    const sources: DataSource[] = [];
    const isXml = file.name.toLowerCase().endsWith('.xml');

    if (isXml) {
      const textDecoder = new TextDecoder("utf-8");
      const xmlText = textDecoder.decode(buffer);
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, "text/xml");

      // 1. Tenta detectar NFe
      if (xmlText.includes('<nfeProc') || xmlText.includes('<infNFe') || xmlText.includes('<NFe')) {
        const dets = doc.getElementsByTagName("det");
        if (dets.length > 0) {
          sources.push({ id: 'nfe', name: 'Nota Fiscal (NFe)', count: dets.length, type: 'nfe' });
          return sources;
        }
      }

      // 2. Tenta detectar XML Spreadsheet (Excel XML)
      const worksheets = doc.getElementsByTagName("Worksheet");
      if (worksheets.length > 0) {
        for (let i = 0; i < worksheets.length; i++) {
          const ws = worksheets[i];
          const name = ws.getAttribute("ss:Name") || `Planilha ${i + 1}`;
          const rows = ws.getElementsByTagName("Row").length;
          // Só adiciona se tiver dados (ignora header row na contagem simples)
          if (rows > 1) {
            sources.push({ id: `ws:${i}`, name, count: rows, type: 'xml-table' });
          }
        }
        return sources;
      }

      // 3. Tenta detectar Tabelas Genéricas (Listas Repetitivas)
      const checkNode = (node: Element, path: string) => {
        const childCounts = new Map<string, number>();
        // Conta ocorrências de cada tag filha direta
        for (let i = 0; i < node.children.length; i++) {
          const tag = node.children[i].tagName;
          childCounts.set(tag, (childCounts.get(tag) || 0) + 1);
        }

        childCounts.forEach((count, tag) => {
          // Se houver mais de 3 elementos iguais, considera uma tabela
          if (count > 2) {
            sources.push({
              id: `xml:${path}:${tag}`,
              name: `<${tag}> (em <${node.tagName}>)`,
              count,
              type: 'xml-table'
            });
          }
        });

        // Recursão limitada (evitar travar em XMLs gigantes)
        // Só entra se não for uma "folha" de dados
        if (node.children.length < 100) { // Otimização: não entrar em nós que JÁ SÃO a lista
          for (let i = 0; i < node.children.length; i++) {
            // Evita recursão profunda desnecessária
            if (node.children[i].children.length > 0) {
              checkNode(node.children[i], `${path}/${node.tagName}`);
            }
          }
        }
      };

      checkNode(doc.documentElement, "");
      return sources;

    } else {
      // Excel (XLSX/XLS)
      const data = new Uint8Array(buffer);
      const workbook = XLSX.read(data, { type: 'array' });

      workbook.SheetNames.forEach(name => {
        const sheet = workbook.Sheets[name];
        if (sheet['!ref']) {
          const range = XLSX.utils.decode_range(sheet['!ref']);
          const count = range.e.r - range.s.r + 1;
          if (count > 1) { // Ignora abas vazias ou só cabeçalho
            sources.push({ id: name, name, count, type: 'sheet' });
          }
        }
      });
    }
    return sources;
  };

  // --- Extrai dados da Fonte Selecionada ---
  const extractDataFromSource = async (source: DataSource, file: File, buffer: ArrayBuffer) => {
    addLog(`Extraindo dados da fonte: ${source.name}`);

    if (source.type === 'nfe') {
      // Reutiliza lógica NFe existente
      const { headers, data, mappingSuggestion } = await parseNFe(file, buffer);
      return { headers, data, mappingSuggestion };
    }

    if (source.type === 'sheet') {
      // Excel Standard
      const data = new Uint8Array(buffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[source.id];
      const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      const { headerRowIndex, headers } = analyzeSpreadsheet(rawMatrix);
      const json = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex, defval: "" });
      return { headers, data: json as any[] };
    }

    if (source.type === 'xml-table') {
      const textDecoder = new TextDecoder("utf-8");
      const xmlText = textDecoder.decode(buffer);
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, "text/xml");

      let rows: Element[] = [];
      let headers: string[] = [];
      let jsonData: any[] = [];

      if (source.id.startsWith('ws:')) {
        // XML Spreadsheet
        const index = parseInt(source.id.split(':')[1]);
        const ws = doc.getElementsByTagName("Worksheet")[index];
        const xmlRows = ws.getElementsByTagName("Row");

        // Converte XML Row -> Array
        // Nota: XML Spreadsheet é complexo, células podem ter índices. Simplificação:
        const extractRowData = (row: Element) => {
          const cells = row.getElementsByTagName("Cell");
          const rowData: string[] = [];
          for (let i = 0; i < cells.length; i++) {
            const data = cells[i].getElementsByTagName("Data")[0];
            rowData.push(data ? data.textContent || "" : "");
          }
          return rowData;
        };

        const matrix: any[][] = [];
        for (let i = 0; i < xmlRows.length; i++) matrix.push(extractRowData(xmlRows[i]));

        const { headerRowIndex, headers: detectedHeaders } = analyzeSpreadsheet(matrix);
        headers = detectedHeaders;

        // Monta JSON
        for (let i = headerRowIndex + 1; i < matrix.length; i++) {
          const row = matrix[i];
          const obj: any = {};
          headers.forEach((h, idx) => obj[h] = row[idx]);
          jsonData.push(obj);
        }

      } else if (source.id.startsWith('xml:')) {
        // Tabela Genérica
        const parts = source.id.split(':');
        const tagName = parts[parts.length - 1]; // Tag final (ex: Produto)
        const elements = doc.getElementsByTagName(tagName);

        // Descobre colunas (união de todas as tags filhas encontradas nos elementos)
        const headerSet = new Set<string>();
        for (let i = 0; i < Math.min(elements.length, 50); i++) { // Amostra
          const el = elements[i];
          for (let j = 0; j < el.children.length; j++) {
            headerSet.add(el.children[j].tagName);
          }
        }
        headers = Array.from(headerSet);

        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];
          const obj: any = {};
          for (let j = 0; j < el.children.length; j++) {
            const child = el.children[j];
            obj[child.tagName] = child.textContent;
          }
          jsonData.push(obj);
        }
      }

      return { headers, data: jsonData };
    }

    throw new Error("Tipo de fonte desconhecido");
  };

  // --- Função Específica para NFe ---
  const parseNFe = async (file: File, buffer: ArrayBuffer): Promise<{ headers: string[], data: any[], mappingSuggestion?: Record<string, string> }> => {
    addLog("Processando NFe...");
    const textDecoder = new TextDecoder("utf-8");
    const xmlText = textDecoder.decode(buffer);

    // Validação básica de NFe
    if (!xmlText.includes('<nfeProc') && !xmlText.includes('<infNFe') && !xmlText.includes('<NFe')) {
      throw new Error("O arquivo XML não parece ser uma Nota Fiscal Eletrônica (NFe) válida.");
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    const parserError = xmlDoc.getElementsByTagName("parsererror");
    if (parserError.length > 0) throw new Error("XML malformado (erro de sintaxe).");

    const dets = xmlDoc.getElementsByTagName("det");
    if (dets.length === 0) throw new Error("Nenhum item encontrado na NFe (tag <det> ausente).");

    addLog(`XML parsed: ${dets.length} itens encontrados.`);

    // Extrair Data de Emissão Global
    let emissionDate = new Date().toISOString().split('T')[0];
    const ide = xmlDoc.getElementsByTagName("ide")[0];
    if (ide) {
      const dhEmi = ide.getElementsByTagName("dhEmi")[0]?.textContent;
      const dEmi = ide.getElementsByTagName("dEmi")[0]?.textContent;
      const rawDate = dhEmi || dEmi;
      if (rawDate) {
        emissionDate = rawDate.split('T')[0];
        addLog(`Data de emissão da NFe: ${emissionDate}`);
      }
    }

    const items: any[] = [];
    const getTag = (parent: Element, tagName: string) => {
      const els = parent.getElementsByTagName(tagName);
      return els.length > 0 ? els[0].textContent || "" : "";
    };

    for (let i = 0; i < dets.length; i++) {
      const prod = dets[i].getElementsByTagName("prod")[0];
      if (prod) {
        items.push({
          cProd: getTag(prod, "cProd"),
          xProd: getTag(prod, "xProd"),
          uCom: getTag(prod, "uCom"),
          qCom: parseFloat(getTag(prod, "qCom")) || 0,
          vUnCom: parseFloat(getTag(prod, "vUnCom")) || 0,
          vProd: parseFloat(getTag(prod, "vProd")) || 0,
          NCM: getTag(prod, "NCM"),
          CFOP: getTag(prod, "CFOP"),
          nfeDate: emissionDate,
          nfeType: 'IN'
        });
      }
    }

    return {
      headers: ['cProd', 'xProd', 'uCom', 'qCom', 'vUnCom', 'vProd', 'NCM', 'CFOP'],
      data: items,
      mappingSuggestion: {
        cod: 'cProd',
        description: 'xProd',
        unit: 'uCom',
        quantity: 'qCom',
        pmed: 'vUnCom',
        totalValue: 'vProd',
        movementDate: 'nfeDate',
        type: 'nfeType'
      }
    };
  };

  // --- Função de Normalização Prévia (Limpeza de Dados Brutos) ---
  const normalizeRawData = (data: any[], headers: string[]): any[] => {
    addLog("Iniciando normalização de dados brutos...");
    let cleaned = data.filter(row => {
      // 1. Remove linhas vazias ou nulas
      if (!row) return false;

      // 2. Verifica se a linha tem algum conteúdo útil
      const hasContent = headers.some(h => {
        const val = row[h];
        return val !== undefined && val !== null && String(val).trim() !== '';
      });
      if (!hasContent) return false;

      // 3. Remove linhas de Totais que possam ter passado
      const values = Object.values(row).map(v => String(v).toLowerCase());
      const isTotalRow = values.some(v => v === 'total' || v === 'total geral' || v.includes('grand total'));
      if (isTotalRow) return false;

      return true;
    });

    // 4. Trim em todas as strings
    cleaned = cleaned.map(row => {
      const newRow: any = {};
      headers.forEach(h => {
        const val = row[h];
        if (typeof val === 'string') {
          newRow[h] = val.trim();
        } else {
          newRow[h] = val;
        }
      });
      return newRow;
    });

    addLog(`Normalização concluída. ${data.length} -> ${cleaned.length} linhas válidas.`);
    return cleaned;
  };

  // --- Processamento da Fonte Selecionada ---
  const processSource = async (source: DataSource, file: File, buffer: ArrayBuffer) => {
    setCurrentSourceId(source.id);
    setStatus('importing');
    addLog(`Processando fonte selecionada: ${source.name}...`);

    try {
      // PASSO 1: EXTRAÇÃO
      const { headers, data, mappingSuggestion } = await extractDataFromSource(source, file, buffer);

      // PASSO 2: NORMALIZAÇÃO DE DADOS BRUTOS (Limpeza)
      const normalizedData = normalizeRawData(data, headers);

      if (normalizedData.length === 0) {
        throw new Error("A fonte selecionada não contém dados válidos após a normalização.");
      }

      setHeaders(headers);
      setRawRows(normalizedData); // Dados limpos e normalizados

      // PASSO 3: MAPEAR COLUNAS (Automático)
      addLog("Iniciando auto-mapeamento de colunas...");
      addLog(`Colunas identificadas: ${headers.join(', ')}`);

      let autoMap: Record<string, string> = mappingSuggestion || {};

      if (!mappingSuggestion) {
        try {
          // Lógica heurística para Excel - Blindada
          const lowerHeaders = headers
            .filter(h => h && typeof h === 'string') // Garante que só processamos strings válidas
            .map(h => ({
              original: h,
              lower: h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            }));

          const findMatch = (keywords: string[]) => {
            if (!lowerHeaders || lowerHeaders.length === 0) return '';

            const match = lowerHeaders.find(item => {
              if (!item || !item.lower) return false;
              return keywords.some(k => item.lower === k || item.lower.includes(k));
            });
            return match ? match.original : '';
          };

          if (target === 'products') {
            autoMap['cod'] = findMatch(['codigo', 'cod', 'ref', 'sku', 'ean']);
            autoMap['description'] = findMatch(['descricao', 'nome', 'produto', 'desc', 'embalagens', 'embalagem', 'item']);
            autoMap['unit'] = findMatch(['unidade', 'und', 'un', 'medida']);
            autoMap['minStock'] = findMatch(['minimo', 'seguranca', 'demand']);
            autoMap['pmed'] = findMatch(['pmed', 'custo', 'medio', 'preco', 'valor']);
            autoMap['storageLocation'] = findMatch(['local', 'deposito', 'origem', 'destino']);
          } else {
            autoMap['movementDate'] = findMatch(['data', 'dt', 'movimento', 'lancamento']);
            autoMap['cod'] = findMatch(['codigo', 'cod', 'ref', 'sku', 'ean']);
            autoMap['quantity'] = findMatch(['quantidade', 'qtd', 'qde', 'saida', 'entrada']);
            autoMap['type'] = findMatch(['tipo', 'operacao', 'e/s']);
            autoMap['totalValue'] = findMatch(['valor', 'total', 'vlr']);
            autoMap['destination'] = findMatch(['destino', 'setor', 'local']);
            autoMap['invoiceNumber'] = findMatch(['nf', 'nota', 'documento']);
          }
        } catch (mapErr: any) {
          console.error("Erro leve no auto-mapeamento:", mapErr);
          addLog(`Aviso: Não foi possível sugerir colunas automaticamente (${mapErr.message}).`);
        }
      }

      // Remove mapeamentos vazios
      Object.keys(autoMap).forEach(key => {
        if (!autoMap[key]) delete autoMap[key];
      });

      if (Object.keys(autoMap).length > 0) {
        setMapping(prev => ({ ...prev, ...autoMap }));
        addLog(`Mapeamento sugerido para ${Object.keys(autoMap).length} campos.`);
      } else {
        addLog("Nenhum campo mapeado automaticamente.");
      }

      setStatus('mapping');
    } catch (err: any) {
      console.error("Erro no processamento:", err);
      setErrorMessage(err.message || "Erro desconhecido ao processar o arquivo.");
      addLog(`ERRO FATAL: ${err.message}`);
      setStatus('error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('importing'); // Loading state
    setErrorMessage('');
    setLogs([]);
    setImportedSourceIds([]);
    setCurrentSourceId(null);
    addLog(`Iniciando análise do arquivo: ${file.name}`);
    addLog(`Tamanho: ${(file.size / 1024).toFixed(2)} KB`);

    const reader = new FileReader();

    reader.onerror = () => {
      const msg = "Erro crítico ao ler o arquivo. Tente salvar novamente.";
      setErrorMessage(msg);
      addLog(msg);
      setStatus('error');
    };

    reader.onload = async (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        if (!buffer) throw new Error("O arquivo está vazio ou corrompido.");

        // Salva no estado para uso posterior (se houver seleção de fonte)
        setCachedBuffer(buffer);
        setCachedFile(file);

        // Analisa estrutura para encontrar fontes de dados
        const sources = analyzeFileStructure(file, buffer);
        addLog(`${sources.length} fonte(s) de dados encontrada(s).`);

        if (sources.length === 0) {
          throw new Error("Não foi possível identificar nenhuma tabela ou planilha válida neste arquivo.");
        }

        if (sources.length > 1) {
          // Múltiplas fontes -> Deixa o usuário escolher
          setAvailableSources(sources);
          setStatus('selecting-source');
        } else {
          // Fonte única -> Processa direto
          await processSource(sources[0], file, buffer);
        }

      } catch (err: any) {
        console.error("Erro no processamento:", err);
        setErrorMessage(err.message || "Erro desconhecido ao processar o arquivo.");
        addLog(`ERRO FATAL: ${err.message}`);
        setStatus('error');
      }
    };

    try {
      reader.readAsArrayBuffer(file);
    } catch (readErr: any) {
      setErrorMessage("Não foi possível iniciar a leitura do arquivo.");
      addLog(`Erro ao iniciar leitura: ${readErr.message}`);
      setStatus('error');
    }
  };

  const suggestMapping = async (headers: string[], sample: any[]) => {
    setIsAiSuggesting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
        Analise os cabeçalhos e amostra desta planilha de estoque:
        Cabeçalhos: ${headers.join(', ')}
        Amostra: ${JSON.stringify(sample)}

        Determine se é "products" (Cadastro) ou "movements" (Diário).
        Mapeie os cabeçalhos para os campos do sistema.
        Campos Produtos: cod, description, unit, minStock, pmed, storageLocation.
        Campos Movimentos: movementDate, cod, quantity, type, totalValue, invoiceNumber, destination.

        Retorne APENAS um JSON puro (sem markdown):
        {
          "type": "products" | "movements",
          "mapping": { "campo_sistema": "cabeçalho_planilha" }
        }
      `;

      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
      const config = JSON.parse(response.text.replace(/```json|```/g, ''));

      setTarget(config.type);
      setMapping(config.mapping);
    } catch (e) {
      console.warn("IA não conseguiu sugerir mapeamento automático.");
    } finally {
      setIsAiSuggesting(false);
    }
  };

  const parseNum = (v: any) => {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return v;

    const str = String(v).trim();
    if (!str) return 0;

    // Remove caracteres de moeda e espaços
    const cleanStr = str.replace(/[R$\s]/g, '');

    // Heuristic for PT-BR (1.000,00) vs EN (1,000.00)
    // Se tiver vírgula e ponto, decide pelo último separador
    if (cleanStr.includes(',') && cleanStr.includes('.')) {
      const lastDot = cleanStr.lastIndexOf('.');
      const lastComma = cleanStr.lastIndexOf(',');

      if (lastComma > lastDot) {
        // PT-BR: 1.234,56 -> remove ponto, troca vírgula por ponto
        return parseFloat(cleanStr.replace(/\./g, '').replace(',', '.'));
      } else {
        // EN: 1,234.56 -> remove vírgula
        return parseFloat(cleanStr.replace(/,/g, ''));
      }
    }

    // Se só tiver vírgula, assume decimal PT-BR (100,50)
    if (cleanStr.includes(',')) {
      return parseFloat(cleanStr.replace(',', '.'));
    }

    // Se só tiver ponto ou nada, assume normal
    return parseFloat(cleanStr) || 0;
  };

  const parseDate = (v: any) => {
    if (!v) return new Date().toISOString().split('T')[0];

    // Excel Serial Date (ex: 44562)
    if (typeof v === 'number') {
      // Ajuste para datas do Excel (que contam 1900 como bissexto incorretamente, mas SSF cuida disso geralmente)
      // Usando lib do SheetJS se disponível, ou fallback simples
      try {
        const date = XLSX.SSF.parse_date_code(v);
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
      } catch (e) {
        // Fallback simples: Excel start date 1899-12-30
        const d = new Date((v - 25569) * 86400 * 1000);
        return d.toISOString().split('T')[0];
      }
    }

    const str = String(v).trim();

    // Tenta detectar DD/MM/YYYY ou DD-MM-YYYY
    const ptBrMatch = str.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (ptBrMatch) {
      return `${ptBrMatch[3]}-${ptBrMatch[2].padStart(2, '0')}-${ptBrMatch[1].padStart(2, '0')}`;
    }

    // Tenta detectar YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
    }

    // Data inválida ou não reconhecida -> Hoje (ou tratar como erro)
    // Para importação, talvez seja melhor retornar null ou string vazia para forçar erro de validação
    return str; // Retorna original para validação pegar se não for data válida
  };

  const generatePreview = () => {
    let duplicatesCount = 0;
    const codesSeen = new Set<string>();

    const normalized = rawRows.map((row, index) => {
      const item: any = {};
      let isValid = true;
      let invalidReason = '';

      // 1. Map & Clean Types
      (Object.entries(mapping) as [string, string][]).forEach(([sysField, excelCol]) => {
        const val = row[excelCol];

        if (['pmed', 'minStock', 'quantity', 'totalValue', 'vUnCom', 'vProd', 'qCom'].includes(sysField)) {
          item[sysField] = parseNum(val);
        } else if (sysField === 'movementDate') {
          const d = parseDate(val);
          // Validação básica de formato de data final
          if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
            item[sysField] = null; // Data inválida
          } else {
            item[sysField] = d;
          }
        } else if (sysField === 'type') {
          const s = String(val || '').toUpperCase();
          // Normalize Type: 'E', 'ENTRADA', 'IN' -> 'IN'
          if (['E', 'ENTRADA', 'COMPRA', 'IN', 'C'].some(x => s.includes(x))) item[sysField] = 'IN';
          else if (['S', 'SAIDA', 'VENDA', 'OUT', 'V'].some(x => s.includes(x))) item[sysField] = 'OUT';
          else item[sysField] = 'OUT'; // Default
        } else if (sysField === 'cod') {
          item[sysField] = String(val || '').trim().toUpperCase();
        } else {
          item[sysField] = String(val || '').trim();
        }
      });

      // 2. Target-Specific Validation
      if (!item.cod) {
        isValid = false;
        invalidReason = 'Código ausente';
      }

      if (target === 'products') {
        if (!item.description) {
          isValid = false;
          invalidReason = 'Descrição ausente';
        }
        // Deduplication Check
        if (item.cod && codesSeen.has(item.cod)) {
          isValid = false;
          invalidReason = 'Código duplicado na planilha';
          duplicatesCount++;
        }
        if (item.cod) codesSeen.add(item.cod);

      } else { // movements
        if (item.quantity <= 0) {
          isValid = false;
          invalidReason = 'Quantidade deve ser maior que zero';
        }
        if (!item.movementDate) {
          isValid = false;
          invalidReason = 'Data inválida';
        }
        if (!item.type) {
          item.type = 'OUT'; // Default fallback
        }
      }

      return { ...item, _isValid: isValid, _invalidReason: invalidReason, _originalIndex: index };
    });

    const validRows = normalized.filter(r => r._isValid);
    setReport({
      total: rawRows.length,
      valid: validRows.length,
      invalid: rawRows.length - validRows.length,
      duplicates: duplicatesCount
    });

    // Mostra tudo no preview, mas ordena os inválidos primeiro para destaque se houver poucos, ou mantém ordem original
    // Melhor estratégia: Manter ordem original para o usuário comparar com a planilha dele
    setPreviewData(normalized);
    setStatus('preview');
  };

  const handleConfirmImport = async () => {
    const validData = previewData.filter(i => i._isValid);
    if (validData.length === 0) {
      setErrorMessage("Não há dados válidos para importar.");
      setStatus('error');
      return;
    }

    setStatus('importing');
    try {
      // Resolve Category Logic
      let finalCategoryId = selectedCategoryId;

      if (target === 'products' && selectedCategoryId === 'new') {
        throw new Error("Por favor, selecione uma categoria válida ou crie uma nova no gerenciador.");
      } else if (target === 'products' && selectedCategoryId) {
        addLog(`Usando categoria existente ID: ${selectedCategoryId}`);
      }

      const currentProducts = await db.getProducts();
      let processedCount = 0;

      for (const item of validData) {
        if (target === 'products') {
          // Injeta a categoria selecionada, se houver
          if (finalCategoryId && finalCategoryId !== 'new') {
            item.categoryId = finalCategoryId;
          }

          const ex = currentProducts.find(p => p.cod.toUpperCase() === item.cod.toUpperCase());
          ex ? await db.updateProduct(ex.id, item) : await db.saveProduct(item);
        } else {
          const p = currentProducts.find(prod => prod.cod.toUpperCase() === item.cod.toUpperCase());
          if (p) await db.createMovement({ ...item, productId: p.id, originId: 'IMPORT_IA' });
        }
        processedCount++;
        if (processedCount % 10 === 0) addLog(`Processados ${processedCount} registros...`);
      }
      addLog("Importação finalizada com sucesso!");

      if (currentSourceId) {
        setImportedSourceIds(prev => {
          const newSet = new Set(prev);
          newSet.add(currentSourceId);
          return Array.from(newSet);
        });

        // Add Audit Log
        const sourceName = availableSources.find(s => s.id === currentSourceId)?.name || 'Tabela';
        const fileName = cachedFile?.name || 'Arquivo';

        db.addAuditLog({
          entity: 'IMPORT_BATCH',
          entityId: new Date().getTime().toString(),
          action: 'IMPORT',
          afterJson: JSON.stringify({
            fileName,
            sourceName,
            records: validData.length,
            target
          })
        }).then(() => loadHistory());
      }

      setStatus('success');
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao salvar os dados. Verifique sua conexão.");
      addLog(`Erro fatal: ${err.message}`);
      setStatus('error');
    }
  };

  // === EXPORT FUNCTIONALITY ===
  const [exportType, setExportType] = useState<'products' | 'suppliers' | 'movements' | 'stock'>('products');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      let data: any[] = [];
      let fileName = '';
      let headers: string[] = [];

      switch (exportType) {
        case 'products':
          const products = await db.getProducts();
          headers = ['Código', 'Descrição', 'Unidade', 'Estoque Mínimo', 'Localização', 'Categoria'];
          data = products.map(p => ({
            'Código': p.cod,
            'Descrição': p.description,
            'Unidade': p.unit,
            'Estoque Mínimo': p.minStock,
            'Localização': p.storageLocation || '',
            'Categoria': p.categoryId || ''
          }));
          fileName = `Produtos_${new Date().toISOString().split('T')[0]}.xlsx`;
          break;

        case 'suppliers':
          const suppliers = await db.getSuppliers();
          headers = ['Nome', 'CNPJ', 'Telefone', 'Email', 'Endereço'];
          data = suppliers.map(s => ({
            'Nome': s.name,
            'CNPJ': s.cnpj || '',
            'Telefone': s.phone,
            'Email': s.email,
            'Endereço': s.address
          }));
          fileName = `Fornecedores_${new Date().toISOString().split('T')[0]}.xlsx`;
          break;

        case 'movements':
          const movements = await db.getMovements();
          headers = ['Data', 'Produto', 'Tipo', 'Quantidade', 'Valor Total', 'NF', 'Destino'];
          data = movements.map(m => ({
            'Data': new Date(m.movementDate).toLocaleDateString('pt-BR'),
            'Produto': m.productId,
            'Tipo': m.type === MovementType.IN ? 'Entrada' : 'Saída',
            'Quantidade': m.quantity,
            'Valor Total': m.totalValue,
            'NF': m.invoiceNumber || '',
            'Destino': m.destination || ''
          }));
          fileName = `Movimentacoes_${new Date().toISOString().split('T')[0]}.xlsx`;
          break;

        case 'stock':
          const allProducts = await db.getProducts();
          const allMovements = await db.getMovements();
          // Calculate stock for each product
          const stockMap: Record<string, number> = {};
          allProducts.forEach(p => { stockMap[p.id] = 0; });
          allMovements.forEach(m => {
            if (m.type === MovementType.IN) {
              stockMap[m.productId] = (stockMap[m.productId] || 0) + m.quantity;
            } else {
              stockMap[m.productId] = (stockMap[m.productId] || 0) - m.quantity;
            }
          });
          headers = ['Código', 'Descrição', 'Saldo Atual', 'Estoque Mínimo', 'Status'];
          data = allProducts.map(p => ({
            'Código': p.cod,
            'Descrição': p.description,
            'Saldo Atual': stockMap[p.id] || 0,
            'Estoque Mínimo': p.minStock,
            'Status': (stockMap[p.id] || 0) < p.minStock ? 'BAIXO' : 'OK'
          }));
          fileName = `Estoque_${new Date().toISOString().split('T')[0]}.xlsx`;
          break;
      }

      // Create workbook and sheet
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Dados');
      XLSX.writeFile(wb, fileName);

      // Log export
      await db.addAuditLog({
        entity: 'EXPORT',
        entityId: exportType,
        action: 'EXPORT' as any,
        userId: user?.id || '',
        afterJson: JSON.stringify({ type: exportType, count: data.length, fileName })
      });

    } catch (error: any) {
      console.error('Erro ao exportar:', error);
      alert('Erro ao exportar dados: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Planilhas e Dados</h2>
          <p className="text-slate-500 dark:text-slate-400">Importe dados externos ou exporte relatórios do sistema.</p>
        </div>
        {activeTab === 'import' && status !== 'idle' && (
          <button onClick={() => setStatus('idle')} className="text-xs font-black uppercase text-slate-400 hover:text-red-500 flex items-center gap-2">
            <Trash2 size={14} /> Cancelar Processo
          </button>
        )}
      </header>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('import')}
          className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'import'
            ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
        >
          Importar Dados
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'export'
            ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
        >
          Exportar Relatórios
        </button>
      </div>

      {activeTab === 'import' ? (

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="flex-1 w-full space-y-6">

            {status === 'idle' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <button
                    onClick={() => setTarget('products')}
                    className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 ${target === 'products' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-800 hover:border-blue-300'}`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${target === 'products' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <PackageSearch size={24} />
                    </div>
                    <div className="text-center">
                      <h3 className={`font-bold ${target === 'products' ? 'text-blue-600' : 'text-slate-600'}`}>Cadastro de Itens</h3>
                      <p className="text-xs text-slate-400 mt-1">Importar catálogo de produtos</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setTarget('movements')}
                    className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 ${target === 'movements' ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300'}`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${target === 'movements' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <ArrowRight size={24} />
                    </div>
                    <div className="text-center">
                      <h3 className={`font-bold ${target === 'movements' ? 'text-emerald-600' : 'text-slate-600'}`}>Movimentações</h3>
                      <p className="text-xs text-slate-400 mt-1">Entradas e saídas de estoque</p>
                    </div>
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-[32px] border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 text-center group hover:border-blue-400 dark:hover:border-blue-600 transition-all">
                  <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-3xl flex items-center justify-center text-blue-600 mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <FileSpreadsheet size={40} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                    Importar {target === 'products' ? 'Produtos' : 'Movimentações'}
                  </h3>
                  <p className="text-sm text-slate-400 max-w-sm mx-auto mb-8">Arraste seu arquivo Excel (.xlsx), CSV ou XML para começar.</p>
                  <input type="file" id="up" className="hidden" accept=".xlsx,.xls,.csv,.xml" onChange={handleFileUpload} />
                  <label htmlFor="up" className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 cursor-pointer shadow-xl shadow-blue-500/20 active:scale-95 transition-all">
                    Selecionar Arquivo
                  </label>
                </div>
              </div>
            )}

            {status === 'selecting-source' && (
              <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 p-8 text-center animate-in zoom-in duration-300">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <ListChecks size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Selecione a Tabela</h3>
                <p className="text-sm text-slate-400 mb-8 max-w-md mx-auto">
                  Encontramos múltiplas fontes de dados neste arquivo. Qual delas você deseja importar?
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto max-h-[400px] overflow-y-auto p-2">
                  {availableSources.map((source) => {
                    const isImported = importedSourceIds.includes(source.id);
                    return (
                      <button
                        key={source.id}
                        onClick={() => cachedFile && cachedBuffer && processSource(source, cachedFile, cachedBuffer)}
                        className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all group text-left ${isImported
                          ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10'
                          : 'border-slate-100 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10'
                          }`}
                      >
                        <div className="flex items-center gap-3 w-full mb-2">
                          <div className={`p-2 rounded-lg ${isImported ? 'bg-emerald-200 text-emerald-700' :
                            source.type === 'nfe' ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'
                            }`}>
                            {isImported ? <CheckCircle2 size={16} /> : (source.type === 'nfe' ? <FileUp size={16} /> : <Table size={16} />)}
                          </div>
                          <span className={`font-bold truncate flex-1 ${isImported ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200 group-hover:text-blue-600'}`}>
                            {source.name}
                          </span>
                          {isImported && <span className="text-[10px] font-black uppercase bg-emerald-200 text-emerald-800 px-2 py-1 rounded-full">Importado</span>}
                        </div>
                        <div className="text-xs text-slate-400 font-medium pl-1">
                          {source.count} registros estimados
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {status === 'mapping' && (
              <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                      <Settings2 size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Configurar Mapeamento</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Passo 1: Vincular Colunas</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <select value={target} onChange={(e) => setTarget(e.target.value as any)} className="bg-white dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-xs font-black uppercase text-blue-600 outline-none ring-2 ring-blue-100 dark:ring-blue-900/30">
                      <option value="products">Cadastro de Itens</option>
                      <option value="movements">Diário de Movimentos</option>
                    </select>
                    <button onClick={generatePreview} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition flex items-center gap-2">
                      Ver Preview <ArrowRight size={16} />
                    </button>
                  </div>
                </div>

                <div className="p-8">
                  {target === 'products' && (
                    <div className="mb-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800/50">
                      <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100 uppercase tracking-wide mb-4 flex items-center gap-2">
                        <PackageSearch size={18} /> Categoria Padrão
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-black uppercase text-blue-400 tracking-widest ml-1">
                            Selecione a Categoria
                          </label>
                          <select
                            value={selectedCategoryId}
                            onChange={(e) => {
                              if (e.target.value === 'new') {
                                setIsCategoryModalOpen(true);
                              } else {
                                setSelectedCategoryId(e.target.value);
                              }
                            }}
                            className="w-full px-4 py-3 bg-white dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-slate-700 dark:text-slate-200 transition-all shadow-sm"
                          >
                            <option value="">Sem categoria definida</option>
                            {categories.map(c => (
                              <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                            ))}
                            <option value="new" className="font-bold text-blue-600">+ Gerenciar Categorias</option>
                          </select>
                        </div>

                        <div className="flex items-end">
                          <button
                            onClick={() => setIsCategoryModalOpen(true)}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition"
                          >
                            <PackageSearch size={16} /> Gerenciar Categorias
                          </button>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-blue-400/80 font-medium">
                        * Esta categoria será aplicada a todos os produtos importados nesta sessão.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                    {systemFields[target].map(field => (
                      <div key={field.id} className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        <select
                          value={mapping[field.id] || ''}
                          onChange={(e) => setMapping({ ...mapping, [field.id]: e.target.value })}
                          className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-slate-700 dark:text-slate-200 transition-all appearance-none"
                        >
                          <option value="">Não importar este campo</option>
                          {headers.filter(h => h && !h.startsWith('__EMPTY')).map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {status === 'preview' && (
              <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col h-[600px]">
                <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center">
                      <ListChecks size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">Resumo da Importação</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{previewData.length} registros prontos para entrar no sistema</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => setStatus('mapping')} className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-black text-xs uppercase hover:bg-slate-200 transition">Ajustar Mapeamento</button>
                    <button onClick={handleConfirmImport} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700">Confirmar e Gravar</button>
                  </div>
                </div>

                <div className="px-8 py-4 bg-slate-50 dark:bg-slate-800/50 flex gap-6 text-xs border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-500">Total Encontrado:</span>
                    <span className="font-black text-slate-800 dark:text-slate-200">{report.total}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-600">Válidos:</span>
                    <span className="font-black text-emerald-600">{report.valid}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-red-500">Inválidos/Ignorados:</span>
                    <span className="font-black text-red-500">{report.invalid}</span>
                  </div>
                  {target === 'products' && (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-500">Duplicados (Removidos):</span>
                      <span className="font-black text-amber-500">{report.duplicates}</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10 shadow-sm">
                      <tr>
                        <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest w-10">Status</th>
                        {systemFields[target].map(f => (
                          <th key={f.id} className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest whitespace-nowrap">{f.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {previewData.map((row, i) => (
                        <tr key={i} className={`transition group ${!row._isValid ? 'bg-red-50/50 dark:bg-red-900/10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'}`}>
                          <td className="px-4 py-3">
                            {row._isValid ? (
                              <CheckCircle2 size={16} className="text-emerald-500" />
                            ) : (
                              <div className="relative group/tooltip">
                                <AlertCircle size={16} className="text-red-500 cursor-help" />
                                <div className="absolute left-6 top-0 z-50 w-48 p-2 bg-red-600 text-white text-xs rounded shadow-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity">
                                  {row._invalidReason}
                                </div>
                              </div>
                            )}
                          </td>
                          {systemFields[target].map(f => (
                            <td key={f.id} className={`px-6 py-4 text-sm font-bold ${!row._isValid ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-300'}`}>
                              {f.id === 'type' ? (
                                <span className={`px-2 py-1 rounded-md text-[10px] ${!row._isValid ? 'bg-slate-200 text-slate-500' : (row[f.id] === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}`}>
                                  {row[f.id] === 'IN' ? 'ENTRADA' : 'SAÍDA'}
                                </span>
                              ) : (
                                // Formatação de valores para preview
                                ['totalValue', 'pmed', 'cost'].includes(f.id)
                                  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(row[f.id]) || 0)
                                  : row[f.id]
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {status === 'importing' && (
              <div className="h-[400px] flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800">
                <div className="relative mb-8">
                  <Loader2 size={64} className="text-blue-600 animate-spin" />
                  <Sparkles size={24} className="text-blue-400 absolute -top-2 -right-2 animate-pulse" />
                </div>
                <h3 className="text-xl font-bold mb-2">Processando Lançamentos</h3>
                <p className="text-sm text-slate-400 font-medium">Aguarde, estamos validando e gravando as informações no sistema...</p>
              </div>
            )}

            {status === 'success' && (
              <div className="h-[400px] flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 animate-in zoom-in duration-500">
                <div className="w-20 h-20 bg-emerald-500 text-white rounded-[28px] flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/20">
                  <CheckCircle2 size={40} />
                </div>
                <h3 className="text-xl font-bold mb-2">Importação Concluída!</h3>
                <p className="text-sm text-slate-400 mb-8">Todos os dados foram processados e integrados ao seu almoxarifado.</p>

                <div className="flex gap-4">
                  {availableSources.length > 1 && (
                    <button onClick={() => setStatus('selecting-source')} className="px-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                      Importar Outra Tabela
                    </button>
                  )}
                  <button onClick={() => setStatus('idle')} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition">
                    {availableSources.length > 1 ? 'Trocar Arquivo' : 'Novo Upload'}
                  </button>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="p-12 bg-white dark:bg-slate-900 rounded-[32px] border border-red-200 dark:border-red-900/30 text-center">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <AlertCircle size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Ops! Algo deu errado</h3>
                <p className="text-sm text-slate-500 mb-8">{errorMessage}</p>
                <button onClick={() => setStatus('idle')} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest">Tentar Novamente</button>
              </div>
            )}

            {/* Logs de Depuração */}
            {logs.length > 0 && (
              <div className="bg-slate-950 text-slate-400 p-6 rounded-2xl font-mono text-[10px] max-h-60 overflow-y-auto border border-slate-800 shadow-inner">
                <div className="flex items-center justify-between mb-4 sticky top-0 bg-slate-950 pb-2 border-b border-slate-800 z-10">
                  <h4 className="font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2">
                    <Sparkles size={14} className="text-blue-500" /> Log de Processamento
                  </h4>
                  <button onClick={() => setLogs([])} className="text-slate-500 hover:text-red-400 transition">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {logs.map((log, i) => (
                    <div key={i} className="border-l-2 border-slate-800 pl-3 py-0.5 hover:border-blue-500 hover:text-slate-200 transition-colors">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="w-full lg:w-80 space-y-4 sticky top-6">
            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2 text-sm uppercase tracking-wider">
                <Clock size={16} className="text-blue-500" /> Histórico Recente
              </h3>

              {importHistory.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <p>Nenhuma importação recente.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {importHistory.map(item => {
                    let details: any = {};
                    try {
                      details = item.afterJson ? JSON.parse(item.afterJson) : {};
                    } catch (e) { }

                    return (
                      <div key={item.id} className="relative pl-4 border-l-2 border-slate-100 dark:border-slate-800 hover:border-blue-500 transition-colors py-1 group">
                        <div className="absolute -left-[1.5px] top-2 w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700 group-hover:bg-blue-500 transition-colors" />
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate" title={details.sourceName}>
                          {details.sourceName || 'Importação'}
                        </div>
                        <div className="text-[10px] text-slate-400 mb-1 truncate" title={details.fileName}>
                          {details.fileName || 'Arquivo desconhecido'}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-medium">
                          <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[9px]">
                            {details.records || 0} regs
                          </span>
                          <span className="text-slate-400">
                            {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString().slice(0, 5)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ========== EXPORT TAB ========== */
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-2xl">
          <div className="mb-8">
            <h3 className="text-xl font-bold flex items-center gap-2 mb-2">
              <FileSpreadsheet className="text-blue-600" /> Exportar Dados
            </h3>
            <p className="text-slate-500 text-sm">Selecione o tipo de dado que deseja exportar para planilha Excel.</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            {[
              { id: 'products', label: 'Produtos', icon: '📦' },
              { id: 'suppliers', label: 'Fornecedores', icon: '🏭' },
              { id: 'movements', label: 'Movimentações', icon: '↔️' },
              { id: 'stock', label: 'Estoque Atual', icon: '📊' }
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setExportType(opt.id as any)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${exportType === opt.id
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
                  }`}
              >
                <span className="text-2xl">{opt.icon}</span>
                <p className={`font-bold mt-2 ${exportType === opt.id ? 'text-blue-600' : 'text-slate-700 dark:text-slate-200'}`}>
                  {opt.label}
                </p>
              </button>
            ))}
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
            {isExporting ? 'Exportando...' : 'Exportar Planilha'}
          </button>
        </div>
      )}

      {/* Modal de Categorias */}
      <ManageCategoriesModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCategoryChange={handleCategoryChange}
      />
    </div>
  );
};

export default ImportExport;
