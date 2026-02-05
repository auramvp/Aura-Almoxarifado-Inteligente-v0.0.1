import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { Supplier, UserRole, StockMovement, Product, MovementType } from '../types';
import { Search, Plus, Edit, Trash2, X, Save, Phone, Mail, MapPin, Globe, User as UserIcon, Truck, Loader2, Fingerprint, AlertCircle, Building2, History, DollarSign, Package } from 'lucide-react';
import { EmailService } from '../services/emailService';

const Suppliers = ({ user }: any) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplierForHistory, setSelectedSupplierForHistory] = useState<Supplier | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteData, setInviteData] = useState({ email: '', cnpj: '', name: '' });

  const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    cnpj: '',
    phone: '',
    email: '',
    cep: '',
    address: '',
    website: '',
    contactPerson: ''
  });

  const maskCNPJ = (value: string) => {
    const cleanValue = value.replace(/\D/g, '').substring(0, 14);
    return cleanValue
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  const canEdit = user.role === UserRole.ALMOXARIFE || user.permissions?.suppliers === 'full';

  const loadData = async () => {
    const [supData, movData, prodData] = await Promise.all([
      db.getSuppliers(),
      db.getMovements(),
      db.getProducts()
    ]);
    setSuppliers(supData);
    setMovements(movData);
    setProducts(prodData);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenModal = (s: Supplier | null = null) => {
    setErrorMsg(null);
    if (s) {
      setEditingSupplier(s);
      setFormData({
        name: s.name,
        cnpj: s.cnpj || '',
        phone: s.phone,
        email: s.email,
        cep: s.cep || '',
        address: s.address,
        website: s.website || '',
        contactPerson: s.contactPerson || ''
      });
    } else {
      setEditingSupplier(null);
      setFormData({ name: '', cnpj: '', phone: '', email: '', cep: '', address: '', website: '', contactPerson: '' });
    }
    setIsModalOpen(true);
  };

  const handleOpenHistory = (s: Supplier) => {
    setSelectedSupplierForHistory(s);
    setIsHistoryOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSupplier) {
      await db.updateSupplier(editingSupplier.id, formData);
    } else {
      await db.addSupplier(formData);
    }
    await loadData();
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja remover este fornecedor?')) {
      await db.deleteSupplier(id);
      await loadData();
    }
  };

  const fetchCnpjData = async (cnpjValue: string) => {
    const cleanCnpj = cnpjValue.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return;

    setIsLoadingCnpj(true);
    setErrorMsg(null);

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      if (response.ok) {
        const data = await response.json();
        let formattedPhone = '';
        if (data.ddd_telefone_1) {
          formattedPhone = data.ddd_telefone_1.length >= 10
            ? `(${data.ddd_telefone_1.substring(0, 2)}) ${data.ddd_telefone_1.substring(2)}`
            : data.ddd_telefone_1;
        }
        const newAddress = `${data.logradouro || ''}, ${data.numero || 'S/N'}${data.complemento ? ' - ' + data.complemento : ''} - ${data.bairro || ''}, ${data.municipio || ''}/${data.uf || ''}`;
        setFormData(prev => ({
          ...prev,
          name: data.razao_social || data.nome_fantasia || prev.name,
          phone: formattedPhone || prev.phone,
          email: data.email?.toLowerCase() || prev.email,
          cep: data.cep || prev.cep,
          address: newAddress
        }));
      } else {
        setErrorMsg("CNPJ não encontrado na base de dados.");
      }
    } catch (error) {
      setErrorMsg("Erro ao consultar CNPJ.");
    } finally {
      setIsLoadingCnpj(false);
    }
  };

  const fetchCepData = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;
    setIsLoadingCep(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`);
      if (response.ok) {
        const data = await response.json();
        setFormData(prev => ({
          ...prev,
          address: `${data.street || ''}, [NÚMERO] - ${data.neighborhood || ''}, ${data.city || ''}/${data.state || ''}`,
          cep: data.cep
        }));
      }
    } catch (e) { } finally { setIsLoadingCep(false); }
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.cnpj && s.cnpj.includes(searchTerm))
  );

  const historyMovements = useMemo(() => {
    if (!selectedSupplierForHistory) return [];
    // Compara de forma flexível caso o ID venha de formas diferentes
    return movements.filter(m =>
      String(m.supplierId) === String(selectedSupplierForHistory.id) &&
      m.type === MovementType.IN
    );
  }, [selectedSupplierForHistory, movements]);

  const totalSpentWithSupplier = useMemo(() => {
    return historyMovements.reduce((sum, m) => sum + m.totalValue, 0);
  }, [historyMovements]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingInvite(true);
    try {
      await EmailService.sendPartnerInvitation(inviteData.email, inviteData.cnpj, inviteData.name);
      alert('Convite enviado com sucesso!');
      setIsInviteModalOpen(false);
      setInviteData({ email: '', cnpj: '', name: '' });
    } catch (error) {
      console.error('Erro ao enviar convite:', error);
      alert('Erro ao enviar convite. Tente novamente.');
    } finally {
      setIsSendingInvite(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Gestão de Fornecedores</h2>
          <p className="text-slate-500 dark:text-slate-400">Cadastro e consulta de parceiros com histórico de fornecimento.</p>
        </div>
        {canEdit && (
          <div className="flex gap-3">
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition font-bold shadow-sm"
            >
              <Mail size={20} /> Convidar Parceiro
            </button>
            <button onClick={() => handleOpenModal()} className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-bold shadow-md shadow-blue-500/10"><Plus size={20} /> Novo Fornecedor</button>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-colors">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Buscar por nome ou CNPJ..." className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSuppliers.length > 0 ? filteredSuppliers.map(s => (
          <div key={s.id} className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group flex flex-col h-full">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400"><Truck size={24} /></div>
              {canEdit && (
                <div className="flex gap-1 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleOpenModal(s)} className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition" title="Editar"><Edit size={18} /></button>
                  <button onClick={() => handleDelete(s.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition" title="Remover"><Trash2 size={18} /></button>
                </div>
              )}
            </div>

            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">{s.name}</h3>
            {s.cnpj && <p className="text-xs font-mono text-slate-400 dark:text-slate-500 mb-4">{s.cnpj}</p>}

            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400"><Phone size={16} className="text-slate-400" /><span>{s.phone}</span></div>
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400"><Mail size={16} className="text-slate-400" /><span className="truncate">{s.email}</span></div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
              <button onClick={() => handleOpenHistory(s)} className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-blue-600 hover:text-white transition font-black text-[10px] uppercase tracking-widest border border-slate-200 dark:border-slate-700 hover:border-blue-600 group-hover:shadow-sm">
                <History size={14} /> Histórico de Fornecimento
              </button>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-12 text-center text-slate-400 dark:text-slate-600 italic bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">Nenhum fornecedor cadastrado.</div>
        )}
      </div>

      {/* Modal Histórico */}
      {isHistoryOpen && selectedSupplierForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-3xl overflow-hidden border dark:border-slate-800 animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="px-8 py-6 border-b dark:border-slate-800 bg-blue-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl"><History size={24} /></div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-widest leading-none">Histórico de Compras</h3>
                  <p className="text-white/60 text-[10px] font-bold uppercase tracking-tight mt-1">{selectedSupplierForHistory.name}</p>
                </div>
              </div>
              <button onClick={() => setIsHistoryOpen(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition"><X size={20} /></button>
            </div>

            <div className="p-8 flex-1 overflow-auto space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                  <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-1">Total Comprado</p>
                  <p className="text-xl font-black text-emerald-700 dark:text-emerald-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalSpentWithSupplier)}</p>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                  <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-1">Qtd de Lançamentos</p>
                  <p className="text-xl font-black text-blue-700 dark:text-blue-400">{historyMovements.length}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Lançamentos Recentes</h4>
                <div className="space-y-2">
                  {historyMovements.length > 0 ? historyMovements.map(m => {
                    const prod = products.find(p => p.id === m.productId);
                    return (
                      <div key={m.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900/40 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white dark:bg-slate-800 rounded-xl text-slate-400 shadow-sm"><Package size={18} /></div>
                          <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{prod?.description || 'Item do Histórico'}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{new Date(m.movementDate).toLocaleDateString('pt-BR')}</p>
                              <span className="text-[10px] text-slate-300">•</span>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">NF: {m.invoiceNumber || 'S/N'}</p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">+{m.quantity} {prod?.unit || ''}</p>
                          <p className="text-[10px] text-slate-500 font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(m.totalValue)}</p>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="py-12 text-center text-slate-400 italic text-sm">Nenhuma compra registrada para este fornecedor. Certifique-se de selecionar o fornecedor ao lançar a entrada.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-8 border-t dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
              <button onClick={() => setIsHistoryOpen(false)} className="w-full py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:opacity-90 transition">Fechar Histórico</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cadastro */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border dark:border-slate-800">
            <div className="px-6 py-4 border-b dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2"><Building2 size={20} className="text-blue-600" /> {editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              {errorMsg && <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 text-sm border border-red-100"><AlertCircle size={16} /><span>{errorMsg}</span></div>}
              <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30">
                <label className="block text-xs font-bold text-blue-600 uppercase mb-1 flex items-center gap-2"><Fingerprint size={14} /> CNPJ</label>
                <div className="relative">
                  <input type="text" className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-blue-200 rounded-lg outline-none" value={formData.cnpj} onChange={e => setFormData({ ...formData, cnpj: maskCNPJ(e.target.value) })} onBlur={() => fetchCnpjData(formData.cnpj)} />
                  {isLoadingCnpj && <Loader2 className="absolute right-3 top-2.5 text-blue-500 animate-spin" size={18} />}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome / Razão Social</label>
                <input required type="text" className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 rounded-lg outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone</label><input required type="text" className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 rounded-lg outline-none" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label><input required type="email" className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 rounded-lg outline-none" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">CEP</label><input type="text" className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 rounded-lg outline-none" value={formData.cep} onChange={e => setFormData({ ...formData, cep: e.target.value })} onBlur={() => fetchCepData(formData.cep)} /></div>
                <div className="col-span-2"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Endereço</label><input required type="text" className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 rounded-lg outline-none" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} /></div>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 rounded-lg font-bold">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Convite */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border dark:border-slate-800 animate-in zoom-in duration-200">
            <div className="px-8 py-6 border-b dark:border-slate-800 flex items-center justify-between bg-indigo-600 text-white">
              <h3 className="text-xl font-black uppercase tracking-widest flex items-center gap-3"><Mail size={24} /> Convidar Parceiro</h3>
              <button onClick={() => setIsInviteModalOpen(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition"><X size={20} /></button>
            </div>
            <form onSubmit={handleSendInvite} className="p-8 space-y-5">
              <p className="text-sm text-slate-500 font-bold mb-4 italic">
                O parceiro receberá um e-mail com acesso direto à Aura e dados pré-preenchidos.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 leading-none">Razão Social / Nome Fantasia</label>
                  <input
                    required
                    type="text"
                    placeholder="Ex: Empresa de Logística XPTO"
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                    value={inviteData.name}
                    onChange={e => setInviteData({ ...inviteData, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 leading-none">CNPJ (Opcional para envio)</label>
                  <input
                    type="text"
                    placeholder="00.000.000/0000-00"
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-sm"
                    value={inviteData.cnpj}
                    onChange={e => setInviteData({ ...inviteData, cnpj: maskCNPJ(e.target.value) })}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 leading-none">E-mail de Destino</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      required
                      type="email"
                      placeholder="parceiro@email.com"
                      className="w-full pl-12 pr-5 py-3.5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                      value={inviteData.email}
                      onChange={e => setInviteData({ ...inviteData, email: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6 flex gap-3">
                <button type="button" onClick={() => setIsInviteModalOpen(false)} className="flex-1 py-4 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition">Cancelar</button>
                <button
                  type="submit"
                  disabled={isSendingInvite}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSendingInvite ? <Loader2 className="animate-spin" size={18} /> : <Mail size={18} />}
                  {isSendingInvite ? 'Enviando...' : 'Enviar Convite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
