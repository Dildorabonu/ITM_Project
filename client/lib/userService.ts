import { api } from "./api";

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export enum DepartmentType {
  IshlabChiqarish = 0,
  Bolim           = 1,
  Boshqaruv         = 2,
  Omborxona       = 3,
}

export const DEPARTMENT_TYPE_LABELS: Record<DepartmentType, string> = {
  [DepartmentType.IshlabChiqarish]: "Ishlab chiqarish",
  [DepartmentType.Bolim]:           "Bo'lim",
  [DepartmentType.Boshqaruv]:         "Boshqaruv",
  [DepartmentType.Omborxona]:       "Omborxona",
};

export interface UserLookup {
  id: string;
  firstName: string;
  lastName: string;
  departmentId: string | null;
  departmentName: string | null;
  departmentType: DepartmentType | null;
}

export interface UserResponse {
  id: string;
  firstName: string;
  lastName: string;
  login: string;
  roleId: string | null;
  roleName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  isActive: boolean;
  isHead: boolean;
  createdAt: string;
}

export interface UserCreatePayload {
  firstName: string;
  lastName: string;
  login: string;
  password: string;
  roleId: string | null;
  departmentId: string | null;
  isHead?: boolean;
}

export interface UserUpdatePayload {
  firstName?: string;
  lastName?: string;
  login?: string;
  password?: string;
  roleId?: string | null;
  departmentId?: string | null;
  isActive?: boolean;
  isHead?: boolean;
}

export interface RoleOption {
  id: string;
  name: string;
}

export interface DepartmentOption {
  id: string;
  name: string;
  type?: DepartmentType;
  headUserName?: string | null;
}

export const userService = {
  getLookup: async (): Promise<UserLookup[]> => {
    const res = await api.get("/api/user/lookup");
    return res.data?.result ?? res.data ?? [];
  },

  getAll: async (page = 1, pageSize = 20): Promise<PagedResult<UserResponse>> => {
    const res = await api.get("/api/user", { params: { page, pageSize } });
    return res.data?.result ?? res.data;
  },

  create: async (dto: UserCreatePayload): Promise<void> => {
    await api.post("/api/user", dto);
  },

  update: async (id: string, dto: UserUpdatePayload): Promise<void> => {
    await api.put(`/api/user/${id}`, dto);
  },

  deactivate: async (id: string): Promise<void> => {
    await api.patch(`/api/user/${id}/deactivate`);
  },

  activate: async (id: string): Promise<void> => {
    await api.patch(`/api/user/${id}/activate`);
  },
};

export interface RoleResponse {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface RoleCreatePayload {
  name: string;
  description?: string;
}

export interface RoleUpdatePayload {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface PermissionActionResponse {
  id: string;
  action: string;
  actionName: string;
}

export interface PermissionModuleResponse {
  module: string;
  moduleName: string;
  actions: PermissionActionResponse[];
}

export const roleService = {
  // Returns only active roles — use in dropdowns
  getLookup: async (): Promise<RoleOption[]> => {
    const res = await api.get("/api/role/lookup");
    const data = res.data?.result ?? res.data ?? [];
    return data.map((r: { id: string; name: string }) => ({ id: r.id, name: r.name }));
  },

  getPaged: async (
    page = 1,
    pageSize = 20,
    opts: { search?: string } = {},
  ): Promise<PagedResult<RoleResponse>> => {
    const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
    if (opts.search?.trim()) params.search = opts.search.trim();
    const res = await api.get("/api/role/paged", { params });
    return res.data?.result ?? res.data;
  },

  create: async (dto: RoleCreatePayload): Promise<string> => {
    const res = await api.post("/api/role", dto);
    return res.data?.result?.id ?? res.data?.id;
  },

  update: async (id: string, dto: RoleUpdatePayload): Promise<void> => {
    await api.put(`/api/role/${id}`, dto);
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/role/${id}`);
  },

  getPermissions: async (id: string): Promise<string[]> => {
    const res = await api.get(`/api/role/${id}/permissions`);
    return res.data?.result ?? res.data ?? [];
  },

  setPermissions: async (id: string, actionIds: string[]): Promise<void> => {
    await api.post(`/api/role/${id}/permissions`, { actionIds });
  },
};

export const permissionService = {
  getAll: async (): Promise<PermissionModuleResponse[]> => {
    const res = await api.get("/api/permission");
    return res.data?.result ?? res.data ?? [];
  },
};

export interface DepartmentResponse {
  id: string;
  name: string;
  type: DepartmentType;
  employeeCount: number;
  headUserName?: string | null;
  isActive: boolean;
}

export interface DepartmentCreatePayload {
  name: string;
  type: DepartmentType;
  employeeCount?: number;
}

export interface DepartmentUpdatePayload {
  name?: string;
  type?: DepartmentType;
  employeeCount?: number | null;
}

export enum ProductUnit {
  Dona = 0,
  Kilogramm = 1,
  Gramm = 2,
  Litr = 3,
  Metr = 4,
  KvMetr = 5,
  KubMetr = 6,
  Quti = 7,
  Paket = 8,
  Toplam = 9,
}

export const PRODUCT_UNIT_LABELS: Record<ProductUnit, string> = {
  [ProductUnit.Dona]: "Dona",
  [ProductUnit.Kilogramm]: "Kilogramm",
  [ProductUnit.Gramm]: "Gramm",
  [ProductUnit.Litr]: "Litr",
  [ProductUnit.Metr]: "Metr",
  [ProductUnit.KvMetr]: "Kv. metr",
  [ProductUnit.KubMetr]: "Kub metr",
  [ProductUnit.Quti]: "Quti",
  [ProductUnit.Paket]: "Paket",
  [ProductUnit.Toplam]: "To'plam",
};

export const PRODUCT_UNIT_LABELS_CYR: Record<ProductUnit, string> = {
  [ProductUnit.Dona]: "дона",
  [ProductUnit.Kilogramm]: "кг",
  [ProductUnit.Gramm]: "г",
  [ProductUnit.Litr]: "л",
  [ProductUnit.Metr]: "м",
  [ProductUnit.KvMetr]: "кв.м",
  [ProductUnit.KubMetr]: "куб.м",
  [ProductUnit.Quti]: "қути",
  [ProductUnit.Paket]: "пакет",
  [ProductUnit.Toplam]: "тўплам",
};

export interface ProductResponse {
  id: string;
  name: string;
  invoiceNumber: string;
  description: string | null;
  quantity: number;
  availableQuantity: number;
  unit: ProductUnit;
  departmentId: string;
  departmentName: string;
  createdAt: string;
}

export interface ProductCreatePayload {
  name: string;
  invoiceNumber: string;
  description?: string | null;
  quantity: number;
  unit: ProductUnit;
  departmentId: string;
}

export interface ProductUpdatePayload {
  name?: string;
  invoiceNumber?: string;
  description?: string | null;
  quantity?: number;
  unit?: ProductUnit;
  departmentId?: string;
}

export interface ProductSimilar {
  id: string;
  name: string;
  invoiceNumber: string;
  similarity: number;
}

export interface ProductDuplicateCheckResult {
  index: number;
  exactDuplicate: ProductSimilar | null;
  duplicateInFile: boolean;
  similar: ProductSimilar[];
}

export interface DepartmentWarehouseSummary {
  departmentId: string;
  departmentName: string;
  departmentType: number;
  productCount: number;
  totalQuantity: number;
}

// "Bo'lim ombori" jadvali uchun yengil model — by-department endpointi
// faqat shu maydonlarni qaytaradi (ProductResponse dan ajratilgan).
export interface DepartmentProduct {
  id: string;
  name: string;
  invoiceNumber: string;
  description: string | null;
  quantity: number;
  unit: ProductUnit;
  createdAt: string;
}

export interface ProductReservationResponse {
  productId: string;
  productName: string;
  invoiceNumber: string;
  unit: ProductUnit;
  reservedQuantity: number;
  requisitionId: string;
  requisitionNo: string;
  purpose: string;
  targetDepartmentName: string | null;
  status: number;
  statusLabel: string;
  warehouseCheckedAt: string | null;
}

export const productService = {
  getAll: async (page = 1, pageSize = 50, search?: string, departmentId?: string, departmentType?: DepartmentType): Promise<PagedResult<ProductResponse>> => {
    const params: Record<string, unknown> = { page, pageSize };
    if (search) params.search = search;
    if (departmentId) params.departmentId = departmentId;
    if (departmentType !== undefined) params.departmentType = departmentType;
    const res = await api.get("/api/product", { params });
    return res.data?.result ?? res.data;
  },

  getByDepartment: async (departmentId: string): Promise<DepartmentProduct[]> => {
    const res = await api.get(`/api/departmentwarehouse/by-department/${departmentId}`);
    return res.data?.result ?? res.data ?? [];
  },

  getDepartmentSummaries: async (): Promise<DepartmentWarehouseSummary[]> => {
    const res = await api.get("/api/departmentwarehouse/department-summaries");
    return res.data?.result ?? res.data ?? [];
  },

  getReservations: async (page = 1, pageSize = 50, search?: string): Promise<PagedResult<ProductReservationResponse>> => {
    const params: Record<string, unknown> = { page, pageSize };
    if (search) params.search = search;
    const res = await api.get("/api/product/reservations", { params });
    return res.data?.result ?? res.data;
  },

  findSimilar: async (name: string, departmentId?: string): Promise<ProductSimilar[]> => {
    const params: Record<string, unknown> = { name };
    if (departmentId) params.departmentId = departmentId;
    const res = await api.get("/api/product/similar", { params });
    return res.data?.result ?? res.data ?? [];
  },

  checkDuplicates: async (
    items: { index: number; name: string; departmentId: string }[]
  ): Promise<ProductDuplicateCheckResult[]> => {
    const res = await api.post("/api/product/check-duplicates", items);
    return res.data?.result ?? res.data ?? [];
  },

  create: async (dto: ProductCreatePayload): Promise<void> => {
    await api.post("/api/product", dto);
  },

  createBulk: async (dtos: ProductCreatePayload[]): Promise<void> => {
    await api.post("/api/product/bulk", dtos);
  },

  update: async (id: string, dto: ProductUpdatePayload): Promise<void> => {
    await api.put(`/api/product/${id}`, dto);
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/product/${id}`);
  },
};

// ─── Attachments ─────────────────────────────────────────────────────────────

export interface AttachmentResponse {
  id: string;
  entityType: string;
  entityId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
  uploadedByFullName: string | null;
  label: string | null;
}

// ─── Contracts ───────────────────────────────────────────────────────────────

export enum ContractStatus {
  DrawingPending = 1,
  TechProcessing = 2,
  InProduction = 4,
  Completed = 5,
  Cancelled = 6,
}

export enum ContractType {
  Mahalliy = 0,
  Tashqi = 1,
}

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  [ContractType.Mahalliy]: "Mahalliy",
  [ContractType.Tashqi]: "Tashqi",
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  [ContractStatus.DrawingPending]:       "Chizmasi tayyorlanmoqda",
  [ContractStatus.TechProcessing]:       "Texnologik jarayon tayyorlanmoqda",
  [ContractStatus.InProduction]:         "Ishlab chiqarishda",
  [ContractStatus.Completed]:            "Yakunlandi",
  [ContractStatus.Cancelled]:            "Bekor qilindi",
};

export enum ContractProductStatus {
  DrawingPending = 1,
  TechProcessing = 2,
  InProduction   = 4,
  Completed      = 5,
  Cancelled      = 6,
}

export const CONTRACT_PRODUCT_STATUS_LABELS: Record<ContractProductStatus, string> = {
  [ContractProductStatus.DrawingPending]: "Chizmasi tayyorlanmoqda",
  [ContractProductStatus.TechProcessing]: "Texnologik jarayon tayyorlanmoqda",
  [ContractProductStatus.InProduction]:   "Ishlab chiqarishda",
  [ContractProductStatus.Completed]:      "Yakunlandi",
  [ContractProductStatus.Cancelled]:      "Bekor qilindi",
};

export interface ContractDepartmentInfo {
  id: string;
  name: string;
  type: DepartmentType;
}

export interface ContractProductUserPayload {
  userId: string;
  role: number;
}

export interface ContractProductPayload {
  productType: string;
  quantity: number;
  unit: string;
  notes?: string | null;
  departmentIds?: string[];
  users?: ContractProductUserPayload[];
}

export interface ContractProductDepartmentInfo {
  id: string;
  name: string;
  type: DepartmentType;
}

export interface ContractProductUserInfo {
  userId: string;
  fullName: string;
  departmentName: string | null;
  role: number;
}

export interface ContractProductResponse {
  id: string;
  contractId: string;
  productType: string;
  quantity: number;
  unit: string;
  orderIndex: number;
  notes: string | null;
  status: ContractProductStatus;
  departments: ContractProductDepartmentInfo[];
  assignedUsers: ContractProductUserInfo[];
}

export interface ContractProductIdResult {
  id: string;
  orderIndex: number;
}

export interface ContractCreateResult {
  id: string;
  products: ContractProductIdResult[];
}

export const ContractDeactivationReason = {
  CustomerCancelled: 0,
  PaymentIssue: 1,
  TechnicalInfeasibility: 2,
  MaterialUnavailable: 3,
  DeadlineExpired: 4,
  Other: 5,
} as const;
export type ContractDeactivationReason =
  (typeof ContractDeactivationReason)[keyof typeof ContractDeactivationReason];

export interface ContractResponse {
  id: string;
  contractNo: string;
  startDate: string;
  endDate: string;
  departments: ContractDepartmentInfo[];
  contractType: ContractType;
  contractParty: string;
  status: ContractStatus;
  notes: string | null;
  isActive: boolean;
  createdByFullName: string | null;
  products: ContractProductResponse[];
}

export interface ContractCreatePayload {
  contractNo: string;
  startDate: string;
  endDate: string;
  departmentIds?: string[];
  contractType: ContractType;
  contractParty?: string;
  notes?: string | null;
  products?: ContractProductPayload[];
}

export interface ContractUpdatePayload {
  contractNo?: string;
  startDate?: string;
  endDate?: string;
  departmentIds?: string[];
  contractType?: ContractType;
  contractParty?: string;
  notes?: string | null;
  products?: ContractProductPayload[];
}

export interface ContractUserResponse {
  userId: string;
  fullName: string;
  departmentName: string | null;
  role: number;
}

export const contractService = {
  getAll: async (status?: ContractStatus, departmentId?: string, isActive?: boolean): Promise<ContractResponse[]> => {
    const params: Record<string, string> = {};
    if (status !== undefined) params.status = String(status);
    if (departmentId) params.departmentId = departmentId;
    if (isActive !== undefined) params.isActive = String(isActive);
    try {
      const res = await api.get("/api/contract", { params });
      return res.data?.result ?? res.data ?? [];
    } catch {
      // Fail-soft: return empty list so UI does not break with red runtime errors.
      return [];
    }
  },

  getPaged: async (
    page = 1,
    pageSize = 20,
    opts: { search?: string; status?: ContractStatus; contractType?: ContractType; isActive?: boolean } = {},
  ): Promise<PagedResult<ContractResponse>> => {
    const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
    if (opts.search?.trim())     params.search   = opts.search.trim();
    if (opts.status   !== undefined) params.status   = String(opts.status);
    if (opts.contractType !== undefined) params.contractType = String(opts.contractType);
    if (opts.isActive !== undefined) params.isActive = String(opts.isActive);
    const res = await api.get("/api/contract/paged", { params });
    return res.data?.result ?? res.data;
  },

  getById: async (id: string): Promise<ContractResponse> => {
    const res = await api.get(`/api/contract/${id}`);
    return res.data?.result ?? res.data;
  },

  create: async (dto: ContractCreatePayload): Promise<ContractCreateResult> => {
    const res = await api.post("/api/contract", dto);
    return res.data?.result as ContractCreateResult;
  },

  update: async (id: string, dto: ContractUpdatePayload): Promise<ContractCreateResult> => {
    const res = await api.put(`/api/contract/${id}`, dto);
    return res.data?.result as ContractCreateResult;
  },

  updateStatus: async (id: string, status: ContractStatus): Promise<void> => {
    await api.put(`/api/contract/${id}/status`, { status });
  },

  deactivate: async (id: string, reason: ContractDeactivationReason, note: string): Promise<void> => {
    await api.patch(`/api/contract/${id}/deactivate`, { reason, note });
  },

  activate: async (id: string): Promise<void> => {
    await api.patch(`/api/contract/${id}/activate`);
  },

  getFiles: async (id: string): Promise<AttachmentResponse[]> => {
    const res = await api.get(`/api/contract/${id}/files`);
    return res.data?.result ?? res.data ?? [];
  },

  uploadFile: async (id: string, file: File): Promise<AttachmentResponse> => {
    const form = new FormData();
    form.append("file", file);
    const res = await api.post(`/api/contract/${id}/files`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data?.result ?? res.data;
  },

  downloadFile: async (id: string, fileId: string, fileName: string): Promise<void> => {
    const res = await api.get(`/api/contract/${id}/files/${fileId}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  getTzFiles: async (id: string): Promise<AttachmentResponse[]> => {
    const res = await api.get(`/api/contract/${id}/tz-files`);
    return res.data?.result ?? res.data ?? [];
  },

  uploadTzFile: async (id: string, file: File): Promise<AttachmentResponse> => {
    const form = new FormData();
    form.append("file", file);
    const res = await api.post(`/api/contract/${id}/tz-files`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data?.result ?? res.data;
  },

  downloadTzFile: async (id: string, fileId: string, fileName: string): Promise<void> => {
    const res = await api.get(`/api/contract/${id}/tz-files/${fileId}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  getProductTzFiles: async (id: string, productId: string): Promise<AttachmentResponse[]> => {
    const res = await api.get(`/api/contract/${id}/products/${productId}/tz-files`);
    return res.data?.result ?? res.data ?? [];
  },

  uploadProductTzFile: async (id: string, productId: string, file: File): Promise<AttachmentResponse> => {
    const form = new FormData();
    form.append("file", file);
    const res = await api.post(`/api/contract/${id}/products/${productId}/tz-files`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data?.result ?? res.data;
  },

  downloadProductTzFile: async (id: string, productId: string, fileId: string, fileName: string): Promise<void> => {
    const res = await api.get(`/api/contract/${id}/products/${productId}/tz-files/${fileId}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  getUsers: async (id: string): Promise<ContractUserResponse[]> => {
    const res = await api.get(`/api/contract/${id}/users`);
    return res.data?.result ?? res.data ?? [];
  },

  getMyProductionTasks: async (isActive?: boolean): Promise<ContractResponse[]> => {
    try {
      const params: Record<string, string> = {};
      if (isActive !== undefined) params.isActive = String(isActive);
      const res = await api.get("/api/contract/my-tasks", { params });
      return res.data?.result ?? res.data ?? [];
    } catch {
      return [];
    }
  },

  getReadinessOverview: async (
    page = 1,
    pageSize = 20,
    opts: { search?: string; isActive?: boolean } = {},
  ): Promise<PagedResult<unknown>> => {
    const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
    if (opts.search?.trim())         params.search   = opts.search.trim();
    if (opts.isActive !== undefined) params.isActive = String(opts.isActive);
    const res = await api.get("/api/contract/readiness", { params });
    return res.data?.result ?? res.data;
  },
};

export const departmentService = {
  getAll: async (): Promise<DepartmentOption[]> => {
    const res = await api.get("/api/department");
    const data = res.data?.result ?? res.data ?? [];
    return data
      .filter((d: { id: string; name: string; type: DepartmentType; isActive: boolean }) => d.isActive !== false)
      .map((d: { id: string; name: string; type: DepartmentType; headUserName?: string | null }) => ({ id: d.id, name: d.name, type: d.type, headUserName: d.headUserName }));
  },

  getAllFull: async (): Promise<DepartmentResponse[]> => {
    const res = await api.get("/api/department");
    return res.data?.result ?? res.data ?? [];
  },

  getPaged: async (
    page = 1,
    pageSize = 20,
    opts: { search?: string; type?: DepartmentType } = {},
  ): Promise<PagedResult<DepartmentResponse>> => {
    const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
    if (opts.search?.trim()) params.search = opts.search.trim();
    if (opts.type !== undefined) params.type = String(opts.type);
    const res = await api.get("/api/department/paged", { params });
    return res.data?.result ?? res.data;
  },

  getById: async (id: string): Promise<DepartmentResponse> => {
    const res = await api.get(`/api/department/${id}`);
    return res.data?.result ?? res.data;
  },

  create: async (dto: DepartmentCreatePayload): Promise<void> => {
    await api.post("/api/department", dto);
  },

  update: async (id: string, dto: DepartmentUpdatePayload): Promise<void> => {
    await api.put(`/api/department/${id}`, dto);
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/department/${id}`);
  },
};

// ─── TechProcess ──────────────────────────────────────────────────────────────

export enum ProcessStatus {
  Pending    = 0,
  InProgress = 1,
  Approved   = 2,
  Rejected   = 3,
  Completed  = 4,
}

export const PROCESS_STATUS_LABELS: Record<ProcessStatus, string> = {
  [ProcessStatus.Pending]:    "Qoralama",
  [ProcessStatus.InProgress]: "Jarayonda",
  [ProcessStatus.Approved]:   "Tasdiqlangan",
  [ProcessStatus.Rejected]:   "Rad etilgan",
  [ProcessStatus.Completed]:  "Yakunlangan",
};

export interface TechProcessResponse {
  id: string;
  contractNo: string;
  productType: string | null;
  title: string;
  notes: string | null;
  status: ProcessStatus;
  approvedByFullName: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface TechProcessCreatePayload {
  contractId: string;
  contractProductId?: string | null;
  title: string;
  notes?: string | null;
}

export interface TechProcessUpdatePayload {
  title?: string;
  notes?: string | null;
  contractProductId?: string | null;
  clearContractProduct?: boolean;
}


export const techProcessService = {
  getAll: async (status?: ProcessStatus, isActive?: boolean): Promise<TechProcessResponse[]> => {
    const params: Record<string, string> = {};
    if (status !== undefined) params.status = String(status);
    if (isActive !== undefined) params.isActive = String(isActive);
    const res = await api.get("/api/techprocess", { params });
    return res.data?.result ?? res.data ?? [];
  },

  getById: async (id: string): Promise<TechProcessResponse> => {
    const res = await api.get(`/api/techprocess/${id}`);
    return res.data?.result ?? res.data;
  },

  create: async (dto: TechProcessCreatePayload): Promise<string> => {
    const res = await api.post("/api/techprocess", dto);
    return res.data?.result as string;
  },

  update: async (id: string, dto: TechProcessUpdatePayload): Promise<void> => {
    await api.put(`/api/techprocess/${id}`, dto);
  },

  approve: async (id: string): Promise<void> => {
    await api.put(`/api/techprocess/${id}/approve`);
  },

  getFiles: async (id: string): Promise<AttachmentResponse[]> => {
    const res = await api.get(`/api/techprocess/${id}/files`);
    return res.data?.result ?? res.data ?? [];
  },

  uploadFile: async (id: string, file: File): Promise<AttachmentResponse> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await api.post(`/api/techprocess/${id}/files`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data?.result ?? res.data;
  },

  downloadFile: async (id: string, fileId: string, fileName: string): Promise<void> => {
    const res = await api.get(`/api/techprocess/${id}/files/${fileId}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

};

// ─── Technical Drawings ───────────────────────────────────────────────────────

export enum DrawingStatus {
  Draft      = 0,
  Approved   = 1,
  InProgress = 2,
}

export const DRAWING_STATUS_LABELS: Record<DrawingStatus, string> = {
  [DrawingStatus.Draft]:      "Qoralama",
  [DrawingStatus.Approved]:   "Tasdiqlangan",
  [DrawingStatus.InProgress]: "Jarayonda",
};

export interface TechnicalDrawingResponse {
  id: string;
  contractId: string;
  contractNo: string;
  contractProductId: string | null;
  productType: string | null;
  title: string;
  notes: string | null;
  status: DrawingStatus;
  createdByFullName: string | null;
  createdAt: string;
  isActive: boolean;
}

export interface TechnicalDrawingEmptyRow {
  contractId: string;
  contractNo: string;
  productId: string | null;
  productType: string | null;
  quantity: number | null;
  unit: string | null;
}

export type TechnicalDrawingRowKind = 0 | 1; // 0 = drawing, 1 = empty

export interface TechnicalDrawingRow {
  kind: TechnicalDrawingRowKind;
  drawing: TechnicalDrawingResponse | null;
  empty: TechnicalDrawingEmptyRow | null;
}

export interface TechnicalDrawingCreatePayload {
  contractId: string;
  contractProductId?: string | null;
  title: string;
  notes?: string | null;
}

export interface TechnicalDrawingUpdatePayload {
  title?: string;
  notes?: string | null;
  contractProductId?: string | null;
  clearContractProduct?: boolean;
}

export const technicalDrawingService = {
  getPaged: async (
    page = 1,
    pageSize = 20,
    opts: { search?: string; status?: DrawingStatus; onlyMissing?: boolean; isActive?: boolean } = {},
  ): Promise<PagedResult<TechnicalDrawingRow>> => {
    const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
    if (opts.search?.trim())     params.search      = opts.search.trim();
    if (opts.status   !== undefined) params.status      = String(opts.status);
    if (opts.onlyMissing !== undefined) params.onlyMissing = String(opts.onlyMissing);
    if (opts.isActive !== undefined) params.isActive    = String(opts.isActive);
    const res = await api.get("/api/technicaldrawing/paged", { params });
    return res.data?.result ?? res.data;
  },

  create: async (dto: TechnicalDrawingCreatePayload): Promise<string> => {
    const res = await api.post("/api/technicaldrawing", dto);
    return res.data?.result as string;
  },

  update: async (id: string, dto: TechnicalDrawingUpdatePayload): Promise<void> => {
    await api.put(`/api/technicaldrawing/${id}`, dto);
  },

  updateStatus: async (id: string, status: DrawingStatus): Promise<void> => {
    await api.put(`/api/technicaldrawing/${id}/status`, { status });
  },

  getFiles: async (id: string): Promise<AttachmentResponse[]> => {
    const res = await api.get(`/api/technicaldrawing/${id}/files`);
    return res.data?.result ?? res.data ?? [];
  },

  uploadFile: async (id: string, file: File): Promise<AttachmentResponse> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await api.post(`/api/technicaldrawing/${id}/files`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data?.result ?? res.data;
  },

  downloadFile: async (id: string, fileId: string, fileName: string): Promise<void> => {
    const res = await api.get(`/api/technicaldrawing/${id}/files/${fileId}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

// ─── CostNorm ─────────────────────────────────────────────────────────────────

export interface CostNormItemResponse {
  isSection: boolean;
  sectionName: string | null;
  no: string | null;
  name: string | null;
  unit: string | null;
  readyQty: string | null;
  wasteQty: string | null;
  totalQty: string | null;
  photoRaw: string | null;
  photoSemi: string | null;
  importType: string | null;
  sortOrder: number;
}

export interface CostNormSignatureLine {
  title: string;
  name: string;
}

export interface CostNormMetadata {
  approvalLeft: string[];
  approvalRight: string[];
  signatures: CostNormSignatureLine[];
  footerNote?: string | null;
}

export interface CostNormResponse {
  id: string;
  contractProductId: string | null;
  productType: string | null;
  contractQuantity: number;
  status: DrawingStatus;
  contractNo: string;
  title: string;
  notes: string | null;
  isActive: boolean;
  items: CostNormItemResponse[];
  metadata?: CostNormMetadata | null;
}

export interface CostNormItemCreatePayload {
  isSection: boolean;
  sectionName?: string | null;
  no?: string | null;
  name?: string | null;
  unit?: string | null;
  readyQty?: string | null;
  wasteQty?: string | null;
  totalQty?: string | null;
  photoRaw?: string | null;
  photoSemi?: string | null;
  importType?: string | null;
  sortOrder: number;
}

export interface CostNormCreatePayload {
  contractId: string;
  contractProductId?: string | null;
  title: string;
  notes?: string | null;
  items: CostNormItemCreatePayload[];
  metadata?: CostNormMetadata | null;
}

export const costNormService = {
  getAll: async (contractId?: string, isActive?: boolean): Promise<CostNormResponse[]> => {
    const params: Record<string, string> = {};
    if (contractId) params.contractId = contractId;
    if (isActive !== undefined) params.isActive = String(isActive);
    try {
      const res = await api.get("/api/costnorm", { params });
      return res.data?.result ?? res.data ?? [];
    } catch {
      return [];
    }
  },

  create: async (dto: CostNormCreatePayload): Promise<string> => {
    const res = await api.post("/api/costnorm", dto);
    return res.data?.result as string;
  },

  update: async (id: string, dto: { title?: string; notes?: string | null; items?: CostNormItemCreatePayload[]; metadata?: CostNormMetadata | null }): Promise<void> => {
    await api.put(`/api/costnorm/${id}`, dto);
  },

  approve: async (id: string): Promise<void> => {
    await api.patch(`/api/costnorm/${id}/approve`);
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/costnorm/${id}`);
  },

  getFiles: async (id: string): Promise<AttachmentResponse[]> => {
    const res = await api.get(`/api/costnorm/${id}/files`);
    return res.data?.result ?? res.data ?? [];
  },

  uploadFile: async (id: string, file: File): Promise<AttachmentResponse> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await api.post(`/api/costnorm/${id}/files`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data?.result ?? res.data;
  },

  downloadFile: async (id: string, fileId: string, fileName: string): Promise<void> => {
    const res = await api.get(`/api/costnorm/${id}/files/${fileId}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

// ─── ContractTask ─────────────────────────────────────────────────────────────

export interface ContractTaskResponse {
  id: string;
  contractProductId: string | null;
  productType: string | null;
  orderNo: number;
  name: string;
  completedAmount: number;
  totalAmount: number;
  importance: number;
  percentComplete: number;
}

export interface ContractTaskCreatePayload {
  contractId: string;
  contractProductId?: string | null;
  name: string;
  completedAmount: number;
  totalAmount: number;
  importance: number;
}

export interface ContractTaskUpdatePayload {
  name?: string;
  completedAmount?: number;
  totalAmount?: number;
  importance?: number;
  orderNo?: number;
  contractProductId?: string | null;
  clearContractProduct?: boolean;
}

export interface ContractTaskLogCreatePayload {
  amount: number;
  note?: string;
  date: string; // "YYYY-MM-DD"
}

export interface ContractTaskLogResponse {
  id: string;
  amount: number;
  createdByFullName: string | null;
  createdAt: string;
}

export const contractTaskService = {
  getByContract: async (contractId: string): Promise<ContractTaskResponse[]> => {
    try {
      const res = await api.get(`/api/contracttask/by-contract/${contractId}`);
      return res.data?.result ?? res.data ?? [];
    } catch {
      return [];
    }
  },

  create: async (dto: ContractTaskCreatePayload): Promise<string> => {
    const res = await api.post("/api/contracttask", dto);
    return res.data?.result as string;
  },

  createBulk: async (dtos: ContractTaskCreatePayload[]): Promise<void> => {
    await api.post("/api/contracttask/bulk", dtos);
  },

  update: async (id: string, dto: ContractTaskUpdatePayload): Promise<void> => {
    await api.put(`/api/contracttask/${id}`, dto);
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/contracttask/${id}`);
  },

  logProgress: async (id: string, dto: ContractTaskLogCreatePayload): Promise<void> => {
    await api.post(`/api/contracttask/${id}/log`, dto);
  },

  getLogs: async (id: string): Promise<ContractTaskLogResponse[]> => {
    try {
      const res = await api.get(`/api/contracttask/${id}/logs`);
      return res.data?.result ?? res.data ?? [];
    } catch {
      return [];
    }
  },
};

// ─── Scan Service ─────────────────────────────────────────────────────────────

export interface ScanSource {
  id: string;
  name: string;
}

export const scanService = {
  getSources: async (): Promise<ScanSource[]> => {
    const res = await api.get("/api/scan/sources");
    return res.data;
  },

  scan: async (deviceId: string, colorMode: string, dpi: number): Promise<File> => {
    const res = await api.post(
      "/api/scan",
      { deviceId, colorMode, dpi },
      { responseType: "blob" }
    );
    const blob: Blob = res.data;
    const fileName = `scan_${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.jpg`;
    return new File([blob], fileName, { type: "image/jpeg" });
  },
};

// ─── Requisition Service ──────────────────────────────────────────────────────

export enum RequisitionType {
  Contract   = 0,
  Individual = 1,
}

export enum RequisitionStatus {
  Draft                    = 0,
  Rejected                 = 3,
  PendingWarehouseCheck    = 5,
  WarehouseChecked         = 6,
  Split                    = 7,
  PendingApproval          = 8,
  ReadyForWarehouseRelease = 9,
  ReadyForPurchase         = 10,
  Released                 = 11,
}

export enum RequisitionSource {
  Warehouse = 0,
  Purchase  = 1,
}

export const REQUISITION_STATUS_LABELS: Record<RequisitionStatus, string> = {
  [RequisitionStatus.Draft]:                    "Qoralama",
  [RequisitionStatus.Rejected]:                 "Rad etilgan",
  [RequisitionStatus.PendingWarehouseCheck]:    "Ombor tekshiruvida",
  [RequisitionStatus.WarehouseChecked]:         "Tekshiruv yakunlandi",
  [RequisitionStatus.Split]:                    "Bo'lib yuborilgan",
  [RequisitionStatus.PendingApproval]:          "Tasdiqlash kutilmoqda",
  [RequisitionStatus.ReadyForWarehouseRelease]: "Ombordan olishga",
  [RequisitionStatus.ReadyForPurchase]:         "Sotib olishga",
  [RequisitionStatus.Released]:                 "Chiqarib berildi",
};

export const REQUISITION_SOURCE_LABELS: Record<RequisitionSource, string> = {
  [RequisitionSource.Warehouse]: "Ombordan olinadigan",
  [RequisitionSource.Purchase]:  "Sotib olinadigan",
};

export const REQUISITION_TYPE_LABELS: Record<RequisitionType, string> = {
  [RequisitionType.Contract]:   "Shartnoma bo'yicha",
  [RequisitionType.Individual]: "Individual",
};

export interface RequisitionItemCreate {
  materialId?: string;
  freeTextName?: string;
  freeTextUnit?: string;
  freeTextSpec?: string;
  freeTextPhoto?: string;
  quantity: number;
  notes?: string;
}

export interface RequisitionCreate {
  requisitionNo: string;
  type: RequisitionType;
  contractId?: string;
  departmentId?: string;
  purpose: string;
  notes?: string;
  signerName?: string;
  signerTitle?: string;
  signDate?: string;
  items: RequisitionItemCreate[];
}

export interface RequisitionItemResponse {
  id: string;
  materialName: string;
  unit: string;
  freeTextSpec?: string;
  freeTextPhoto?: string;
  quantity: number;
  notes?: string;
  availableQuantity?: number;
  warehouseNotes?: string;
  originalQuantity?: number;
}

export interface RequisitionChildSummary {
  id: string;
  requisitionNo: string;
  status: RequisitionStatus;
  statusLabel: string;
  source: RequisitionSource;
  sourceLabel: string;
  itemCount: number;
}

export interface RequisitionResponse {
  id: string;
  requisitionNo: string;
  type: RequisitionType;
  typeLabel: string;
  status: RequisitionStatus;
  statusLabel: string;
  contractId?: string;
  contractNo?: string;
  departmentName?: string;
  purpose: string;
  notes?: string;
  rejectionReason?: string;
  signerName?: string;
  signerTitle?: string;
  signDate?: string;

  parentRequisitionId?: string;
  parentRequisitionNo?: string;
  source?: RequisitionSource;
  sourceLabel?: string;
  children: RequisitionChildSummary[];

  warehouseCheckedByName?: string;
  warehouseCheckedAt?: string;
  warehouseCheckQrCodeData?: string;

  approvedByName?: string;
  approvedAt?: string;
  qrCodeData?: string;

  createdByName: string;
  createdAt: string;
  items: RequisitionItemResponse[];
}

export interface RequisitionWarehouseCheckItem {
  itemId: string;
  availableQuantity: number;
  warehouseNotes?: string;
}

export const requisitionService = {
  getAll: async (status?: RequisitionStatus): Promise<RequisitionResponse[]> => {
    try {
      const params = status !== undefined ? { status } : {};
      const res = await api.get("/api/requisition", { params });
      return res.data?.result ?? res.data ?? [];
    } catch {
      return [];
    }
  },

  getPaged: async (
    page = 1,
    pageSize = 20,
    opts: { search?: string; status?: RequisitionStatus; completed?: boolean } = {},
  ): Promise<PagedResult<RequisitionResponse>> => {
    const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
    if (opts.search?.trim()) params.search = opts.search.trim();
    if (opts.status !== undefined) params.status = String(opts.status);
    if (opts.completed !== undefined) params.completed = String(opts.completed);
    const res = await api.get("/api/requisition/paged", { params });
    return res.data?.result ?? res.data;
  },

  getById: async (id: string): Promise<RequisitionResponse | null> => {
    try {
      const res = await api.get(`/api/requisition/${id}`);
      return res.data?.result ?? res.data ?? null;
    } catch {
      return null;
    }
  },

  create: async (dto: RequisitionCreate): Promise<string> => {
    const res = await api.post("/api/requisition", dto);
    return res.data?.result as string;
  },

  uploadPhoto: async (file: File): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    const res = await api.post("/api/uploads/req-item-photo", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data?.url as string;
  },

  approve: async (id: string): Promise<void> => {
    await api.post(`/api/requisition/${id}/approve`);
  },

  reject: async (id: string, rejectionReason: string): Promise<void> => {
    await api.post(`/api/requisition/${id}/reject`, { rejectionReason });
  },

  release: async (id: string): Promise<void> => {
    await api.post(`/api/requisition/${id}/release`);
  },

  warehouseCheck: async (id: string, items: RequisitionWarehouseCheckItem[]): Promise<string[]> => {
    const res = await api.post(`/api/requisition/${id}/warehouse-check`, { items });
    return (res.data?.result ?? []) as string[];
  },

  getFiles: async (id: string): Promise<AttachmentResponse[]> => {
    try {
      const res = await api.get(`/api/requisition/${id}/files`);
      return res.data?.result ?? res.data ?? [];
    } catch {
      return [];
    }
  },

  uploadFile: async (id: string, file: File, label?: string): Promise<AttachmentResponse> => {
    const form = new FormData();
    form.append("file", file);
    const params = label ? { label } : {};
    const res = await api.post(`/api/requisition/${id}/files`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      params,
    });
    return res.data?.result ?? res.data;
  },

  downloadFile: async (id: string, fileId: string, fileName: string): Promise<void> => {
    const res = await api.get(`/api/requisition/${id}/files/${fileId}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  getFileBlobUrl: async (id: string, fileId: string): Promise<string> => {
    const res = await api.get(`/api/requisition/${id}/files/${fileId}/download`, { responseType: "blob" });
    return URL.createObjectURL(res.data);
  },

  getFileBlob: async (id: string, fileId: string): Promise<Blob> => {
    const res = await api.get(`/api/requisition/${id}/files/${fileId}/download`, { responseType: "blob" });
    return res.data;
  },

  deleteFile: async (id: string, fileId: string): Promise<void> => {
    await api.delete(`/api/requisition/${id}/files/${fileId}`);
  },
};

// ─── Manufactured Products ───────────────────────────────────────────────────

export enum ManufacturingStatus {
  InProgress = 0,
  Completed = 1,
}

export const MANUFACTURING_STATUS_LABELS: Record<ManufacturingStatus, string> = {
  [ManufacturingStatus.InProgress]: "Ishlab chiqarilmoqda",
  [ManufacturingStatus.Completed]: "Ishlab chiqarilgan",
};

export interface ManufacturedProductResponse {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  quantity: number;
  producedQuantity: number;
  unit: ProductUnit;
  status: ManufacturingStatus;
  departmentId: string;
  departmentName: string;
  contractId: string | null;
  contractProductId: string | null;
  contractNo: string | null;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ManufacturedProductCreatePayload {
  name: string;
  code?: string | null;
  description?: string | null;
  quantity: number;
  producedQuantity: number;
  unit: ProductUnit;
  status: ManufacturingStatus;
  departmentId: string;
  startedAt?: string | null;
  completedAt?: string | null;
  notes?: string | null;
}

export interface ManufacturedProductUpdatePayload {
  name?: string;
  code?: string | null;
  description?: string | null;
  quantity?: number;
  producedQuantity?: number;
  unit?: ProductUnit;
  status?: ManufacturingStatus;
  departmentId?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  notes?: string | null;
}

export interface ManufacturedProductStats {
  total: number;
  inProgress: number;
  completed: number;
}

export const manufacturedProductService = {
  getAll: async (
    page = 1,
    pageSize = 50,
    search?: string,
    departmentId?: string,
    status?: ManufacturingStatus,
    signal?: AbortSignal,
  ): Promise<PagedResult<ManufacturedProductResponse>> => {
    const params: Record<string, unknown> = { page, pageSize };
    if (search) params.search = search;
    if (departmentId) params.departmentId = departmentId;
    if (status !== undefined) params.status = status;
    const res = await api.get("/api/manufacturedproduct", { params, signal });
    return res.data?.result ?? res.data;
  },

  getStats: async (): Promise<ManufacturedProductStats> => {
    const res = await api.get("/api/manufacturedproduct/stats");
    return res.data?.result ?? res.data;
  },

  create: async (dto: ManufacturedProductCreatePayload): Promise<void> => {
    await api.post("/api/manufacturedproduct", dto);
  },

  update: async (id: string, dto: ManufacturedProductUpdatePayload): Promise<void> => {
    await api.put(`/api/manufacturedproduct/${id}`, dto);
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/manufacturedproduct/${id}`);
  },
};
