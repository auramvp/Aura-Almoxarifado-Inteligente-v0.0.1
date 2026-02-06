
export enum UserRole {
  ALMOXARIFE = 'ALMOXARIFE',
  AUX_ALMOXARIFE = 'AUX_ALMOXARIFE'
}

export type CompanyStatus = 'Ativo' | 'Suspenso' | 'Bloqueado' | 'Pendente' | 'active' | 'suspended' | 'blocked';

export interface SupportTicket {
  id: string;
  companyId: string;
  userId: string;
  userName: string;
  companyName: string;
  description: string;
  status: string;
  createdAt: string;
  resolution?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  startedAt?: string;
  startedBy?: string;
}

export type PermissionLevel = 'none' | 'view' | 'full';

export interface UserPermissions {
  products: PermissionLevel;
  suppliers: PermissionLevel;
  inventory: PermissionLevel;
  movements: PermissionLevel;
  reports: PermissionLevel;
  purchases: PermissionLevel;
  sectors: PermissionLevel;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  accessCode?: string;
  createdAt: string;
  companyId?: string;
  permissions?: UserPermissions;
}

export interface Company {
  id: string;
  cnpj: string;
  name: string;
  address: string;
  email: string;
  phone: string;
  logo?: string;
  sectorName: string;
  sectorResponsible: string;
  sectorWhatsApp: string;
  sectorEmail: string;
  contactExtra?: string;
  settings?: CompanySettings;
  status: CompanyStatus;
  suspensionReason?: string;
  planId?: string;
  createdAt: string;
}

export interface CompanySettings {
  alerts?: {
    minStock: boolean;
    minStockFrequency: 'daily' | 'weekly';
    unusualConsumption: boolean;
    consumptionThreshold: number;
    alertEmails?: string; // Comma separated emails
    alertDays?: number[]; // 0-6
    alertStartTime?: string; // HH:mm
    alertEndTime?: string; // HH:mm
  };
}

export interface Plan {
  id: string;
  name: string;
  maxUsers: number;
  maxItems: number;
  price: number;
  interval: 'monthly' | 'yearly';
  features?: string[];
  active: boolean;
}

export interface Subscription {
  id: string;
  companyId: string;
  planId: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  startDate: string;
  nextBillingDate: string;
  paymentMethod?: string;
  plan?: Plan;
}

export interface Invoice {
  id: string;
  companyId: string;
  amount: number;
  status: 'paid' | 'open' | 'void' | 'uncollectible';
  billingDate: string;
  dueDate: string;
  pdfUrl?: string;
  description: string;
}

export interface TaxDocument {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface TaxAnalysisRequest {
  id: string;
  companyId: string;
  requesterUserId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  documents: TaxDocument[];
  createdAt: string;
  updatedAt: string;
}

// AI Report Types
export interface AiReportAlert {
  type: 'RUPTURA' | 'EXCESSO' | 'PARADO';
  product: string;
  current_stock: number;
  min_stock?: number;
  suggestion: string;
}

export interface AiReportDeadStock {
  product: string;
  days_without_movement: number;
  value: number;
}

export interface AiReportABCItem {
  product: string;
  consumption_value: number;
  percentage: number;
}

export interface Category {
  id: string;
  companyId: string;
  name: string;
  color: string;
  emoji: string;
}

export interface SectorPerson {
  name: string;
  matricula: string;
}

export interface Sector {
  id: string;
  companyId: string;
  name: string;
  color: string;
  people: SectorPerson[];
  createdAt: string;
}

export interface Product {
  id: string;
  companyId: string;
  cod: string;
  description: string;
  unit: string;
  minStock: number;
  categoryId?: string;
  defaultSupplierId?: string;
  storageLocation?: string;
  observations?: string;
  pmed: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  companyId: string;
  name: string;
  cnpj?: string;
  phone: string;
  email: string;
  cep?: string;
  address: string;
  website?: string;
  contactPerson?: string;
}

export interface Location {
  id: string;
  companyId: string;
  name: string;
}

export enum MovementType {
  IN = 'IN',
  OUT = 'OUT'
}

export interface StockMovement {
  id: string;
  companyId: string;
  movementDate: string;
  monthRef: string; // YYYY-MM
  productId: string;
  supplierId?: string;
  sectorId?: string;
  personName?: string;
  originId: string;
  type: MovementType;
  quantity: number;
  totalValue: number;
  invoiceNumber?: string;
  fromLocationId?: string;
  toLocationId?: string;
  destination?: string;
  pmedAtTime: number;
  demand?: number;
  notes?: string;
  createdByUserId: string;
  createdAt: string;
}

export interface StockBalance {
  productId: string;
  locationId: string;
  quantity: number;
}

export interface AuditLog {
  id: string;
  entity: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'EXPORT';
  beforeJson?: string;
  afterJson?: string;
  userId: string;
  createdAt: string;
}

export interface DashboardStats {
  belowMinCount: number;
  totalEntriesMonth: number;
  totalExitsMonth: number;
  totalProducts: number;
  totalInventoryValue: number;
  topItemsByCost: { name: string; value: number }[];
  recentMovements: StockMovement[];
  mostConsumedProduct?: { name: string; quantity: number; unit: string; value: number };
  topConsumerSector?: { name: string; value: number };
  previousMonthExits: number;
  aiInsight?: { title: string; content: string; type: 'success' | 'warning' | 'info' };
}

// AI Report Payload
export interface AiReportPayload {
  company: {
    name: string;
    cnpj: string;
    sector: string;
  };
  period: {
    start: string;
    end: string;
  };
  kpis: {
    total_items: number;
    critical_stock_items: number; // Ruptura
    excess_stock_items: number;
    dead_stock_items_90d: number;
    current_inventory_value: number;
    total_purchases_period: number;
    total_exits_period: number;
  };
  alerts: {
    type: 'RUPTURA' | 'EXCESSO' | 'PARADO';
    product: string;
    current_stock: number;
    min_stock?: number;
    avg_consumption?: number;
    suggestion: string;
  }[];
  abc: {
    curve_a: { product: string; consumption_value: number; percentage: number }[];
    curve_b: { product: string; consumption_value: number; percentage: number }[];
    curve_c: { product: string; consumption_value: number; percentage: number }[];
  };
  dead_stock: {
    product: string;
    days_without_movement: number;
    value: number;
  }[];
  rules: {
    min_stock_method: string;
    dead_stock_days: number;
  };
}
