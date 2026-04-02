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
}

export const DEPARTMENT_TYPE_LABELS: Record<DepartmentType, string> = {
  [DepartmentType.IshlabChiqarish]: "Ishlab chiqarish",
  [DepartmentType.Bolim]:           "Bo'lim",
  [DepartmentType.Boshqaruv]:         "Boshqaruv",
};

export interface UserLookup {
  id: string;
  firstName: string;
  lastName: string;
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

  getById: async (id: string): Promise<UserResponse> => {
    const res = await api.get(`/api/user/${id}`);
    return res.data?.result ?? res.data;
  },

  create: async (dto: UserCreatePayload): Promise<void> => {
    await api.post("/api/user", dto);
  },

  update: async (id: string, dto: UserUpdatePayload): Promise<void> => {
    await api.put(`/api/user/${id}`, dto);
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/user/${id}`);
  },
};

export interface RoleResponse {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
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
  actionIcon: string;
}

export interface PermissionModuleResponse {
  module: string;
  moduleName: string;
  moduleIcon: string;
  actions: PermissionActionResponse[];
}

export const roleService = {
  // Returns only active roles — use in dropdowns
  getLookup: async (): Promise<RoleOption[]> => {
    const res = await api.get("/api/role/lookup");
    const data = res.data?.result ?? res.data ?? [];
    return data.map((r: { id: string; name: string }) => ({ id: r.id, name: r.name }));
  },

  // Returns all roles (active + inactive) — use in management page
  getAll: async (): Promise<RoleOption[]> => {
    const res = await api.get("/api/role");
    const data = res.data?.result ?? res.data ?? [];
    return data.map((r: { id: string; name: string }) => ({ id: r.id, name: r.name }));
  },

  getAllFull: async (): Promise<RoleResponse[]> => {
    const res = await api.get("/api/role");
    return res.data?.result ?? res.data ?? [];
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
  createdAt: string;
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

export interface ProductResponse {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: ProductUnit;
  departmentId: string;
  departmentName: string;
  createdAt: string;
}

export interface ProductCreatePayload {
  name: string;
  description?: string | null;
  quantity: number;
  unit: ProductUnit;
  departmentId: string;
}

export interface ProductUpdatePayload {
  name?: string;
  description?: string | null;
  quantity?: number;
  unit?: ProductUnit;
  departmentId?: string;
}

export const productService = {
  getAll: async (): Promise<ProductResponse[]> => {
    const res = await api.get("/api/product");
    return res.data?.result ?? res.data ?? [];
  },

  getByDepartment: async (departmentId: string): Promise<ProductResponse[]> => {
    const res = await api.get(`/api/product/by-department/${departmentId}`);
    return res.data?.result ?? res.data ?? [];
  },

  getById: async (id: string): Promise<ProductResponse> => {
    const res = await api.get(`/api/product/${id}`);
    return res.data?.result ?? res.data;
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
}

// ─── Contracts ───────────────────────────────────────────────────────────────

export enum ContractStatus {
  Draft = 0,
  DrawingPending = 1,
  TechProcessing = 2,
  WarehouseCheck = 3,
  InProduction = 4,
  Completed = 5,
  Cancelled = 6,
  TechProcessApproved = 7,
}

export enum Priority {
  Low = 0,
  Medium = 1,
  High = 2,
  Urgent = 3,
}

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  [ContractStatus.Draft]:                "Shartnoma yaratilindi",
  [ContractStatus.DrawingPending]:       "Chizmasi tayyorlandi",
  [ContractStatus.TechProcessing]:       "Tex jarayon tayyorlanmoqda",
  [ContractStatus.TechProcessApproved]:  "Texnologik jarayon tasdiqlandi",
  [ContractStatus.WarehouseCheck]:       "Ombor tekshiruvida",
  [ContractStatus.InProduction]:         "Ishlab chiqarishda",
  [ContractStatus.Completed]:            "Yakunlandi",
  [ContractStatus.Cancelled]:            "Bekor qilindi",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  [Priority.Low]:    "Past",
  [Priority.Medium]: "O'rta",
  [Priority.High]:   "Yuqori",
  [Priority.Urgent]: "Shoshilinch",
};

export interface ContractDepartmentInfo {
  id: string;
  name: string;
  type: DepartmentType;
}

export interface ContractResponse {
  id: string;
  contractNo: string;
  productType: string;
  quantity: number;
  unit: string;
  startDate: string;
  endDate: string;
  departments: ContractDepartmentInfo[];
  priority: Priority;
  contractParty: string;
  status: ContractStatus;
  notes: string | null;
  isActive: boolean;
  createdBy: string;
  createdByFullName: string | null;
  createdAt: string;
}

export interface ContractCreatePayload {
  contractNo: string;
  productType?: string;
  quantity?: number;
  unit?: string;
  startDate: string;
  endDate: string;
  departmentIds?: string[];
  priority: Priority;
  contractParty?: string;
  notes?: string | null;
}

export interface ContractUpdatePayload {
  contractNo?: string;
  productType?: string;
  quantity?: number;
  unit?: string;
  startDate?: string;
  endDate?: string;
  departmentIds?: string[];
  priority?: Priority;
  contractParty?: string;
  notes?: string | null;
}

export const ContractUserRole = { Responsible: 0, Supervisor: 1, Observer: 2 } as const;

export interface ContractUserResponse {
  userId: string;
  fullName: string;
  departmentName: string | null;
  role: number;
}

export const contractService = {
  getAll: async (status?: ContractStatus, departmentId?: string): Promise<ContractResponse[]> => {
    const params: Record<string, string> = {};
    if (status !== undefined) params.status = String(status);
    if (departmentId) params.departmentId = departmentId;
    try {
      const res = await api.get("/api/contract", { params });
      return res.data?.result ?? res.data ?? [];
    } catch {
      // Fail-soft: return empty list so UI does not break with red runtime errors.
      return [];
    }
  },

  getById: async (id: string): Promise<ContractResponse> => {
    const res = await api.get(`/api/contract/${id}`);
    return res.data?.result ?? res.data;
  },

  create: async (dto: ContractCreatePayload): Promise<string> => {
    const res = await api.post("/api/contract", dto);
    return res.data?.result as string;
  },

  update: async (id: string, dto: ContractUpdatePayload): Promise<void> => {
    await api.put(`/api/contract/${id}`, dto);
  },

  updateStatus: async (id: string, status: ContractStatus): Promise<void> => {
    await api.put(`/api/contract/${id}/status`, { status });
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/contract/${id}`);
  },

  deactivate: async (id: string): Promise<void> => {
    await api.patch(`/api/contract/${id}/deactivate`);
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
    a.click();
    URL.revokeObjectURL(url);
  },

  deleteFile: async (id: string, fileId: string): Promise<void> => {
    await api.delete(`/api/contract/${id}/files/${fileId}`);
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
    a.click();
    URL.revokeObjectURL(url);
  },

  deleteTzFile: async (id: string, fileId: string): Promise<void> => {
    await api.delete(`/api/contract/${id}/tz-files/${fileId}`);
  },

  getUsers: async (id: string): Promise<ContractUserResponse[]> => {
    const res = await api.get(`/api/contract/${id}/users`);
    return res.data?.result ?? res.data ?? [];
  },

  assignUsers: async (id: string, users: { userId: string; role: number }[]): Promise<void> => {
    await api.post(`/api/contract/${id}/users`, { users });
  },

  removeUser: async (id: string, userId: string): Promise<void> => {
    await api.delete(`/api/contract/${id}/users/${userId}`);
  },

  getMyProductionTasks: async (): Promise<ContractResponse[]> => {
    try {
      const res = await api.get("/api/contract/my-tasks");
      return res.data?.result ?? res.data ?? [];
    } catch {
      return [];
    }
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
  contractId: string;
  contractNo: string;
  title: string;
  notes: string | null;
  status: ProcessStatus;
  currentStep: number;
  approvedBy: string | null;
  approvedByFullName: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface TechProcessCreatePayload {
  contractId: string;
  title: string;
  notes?: string | null;
}

export interface TechProcessUpdatePayload {
  title?: string;
  notes?: string | null;
}


export const techProcessService = {
  getAll: async (status?: ProcessStatus): Promise<TechProcessResponse[]> => {
    const params: Record<string, string> = {};
    if (status !== undefined) params.status = String(status);
    const res = await api.get("/api/techprocess", { params });
    return res.data?.result ?? res.data ?? [];
  },

  getById: async (id: string): Promise<TechProcessResponse> => {
    const res = await api.get(`/api/techprocess/${id}`);
    return res.data?.result ?? res.data;
  },

  getByContract: async (contractId: string): Promise<TechProcessResponse[]> => {
    const res = await api.get(`/api/techprocess/by-contract/${contractId}`);
    return res.data?.result ?? res.data ?? [];
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

  sendToWarehouse: async (id: string): Promise<void> => {
    await api.put(`/api/techprocess/${id}/send-to-warehouse`);
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/techprocess/${id}`);
  },

};

// ─── Material (Ombor) ─────────────────────────────────────────────────────────

export interface MaterialOption {
  id: string;
  name: string;
  unit: string;
  quantity: number;
}

export interface MaterialResponse {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  location: string | null;
  status: number;
  updatedAt: string;
}

export interface MaterialCreatePayload {
  code: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  location?: string | null;
}

export interface MaterialUpdatePayload {
  code?: string;
  name?: string;
  category?: string;
  unit?: string;
  quantity?: number;
  minQuantity?: number;
  location?: string | null;
}

export interface DeficitCheckItem {
  costNormItemName: string;
  costNormItemUnit: string;
  requiredQty: number;
  availableQty: number;
  deficitQty: number;
  existsInInventory: boolean;
  materialId: string | null;
  status: string;
}

export const materialService = {
  getAll: async (category?: string): Promise<MaterialResponse[]> => {
    const params: Record<string, string> = {};
    if (category) params.category = category;
    try {
      const res = await api.get("/api/material", { params });
      return res.data?.result ?? res.data ?? [];
    } catch {
      return [];
    }
  },

  getOptions: async (): Promise<MaterialOption[]> => {
    try {
      const res = await api.get("/api/material");
      const data = res.data?.result ?? res.data ?? [];
      return data.map((m: MaterialResponse) => ({
        id: m.id, name: m.name, unit: m.unit, quantity: m.quantity,
      }));
    } catch {
      return [];
    }
  },

  getById: async (id: string): Promise<MaterialResponse> => {
    const res = await api.get(`/api/material/${id}`);
    return res.data?.result ?? res.data;
  },

  create: async (dto: MaterialCreatePayload): Promise<void> => {
    await api.post("/api/material", dto);
  },

  createBulk: async (dtos: MaterialCreatePayload[]): Promise<void> => {
    await api.post("/api/material/bulk", dtos);
  },

  update: async (id: string, dto: MaterialUpdatePayload): Promise<void> => {
    await api.put(`/api/material/${id}`, dto);
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/material/${id}`);
  },

  checkDeficitByCostNorm: async (costNormId: string): Promise<DeficitCheckItem[]> => {
    try {
      const res = await api.get(`/api/material/deficit/costnorm/${costNormId}`);
      return res.data?.result ?? res.data ?? [];
    } catch {
      return [];
    }
  },
};

// ─── Technical Drawings ───────────────────────────────────────────────────────

export enum DrawingStatus {
  Draft    = 0,
  Approved = 1,
}

export const DRAWING_STATUS_LABELS: Record<DrawingStatus, string> = {
  [DrawingStatus.Draft]:    "Qoralama",
  [DrawingStatus.Approved]: "Tasdiqlangan",
};

export interface TechnicalDrawingResponse {
  id: string;
  contractId: string;
  contractNo: string;
  title: string;
  notes: string | null;
  status: DrawingStatus;
  createdBy: string;
  createdByFullName: string | null;
  createdAt: string;
}

export interface TechnicalDrawingCreatePayload {
  contractId: string;
  title: string;
  notes?: string | null;
}

export interface TechnicalDrawingUpdatePayload {
  title?: string;
  notes?: string | null;
}

export const technicalDrawingService = {
  getAll: async (status?: DrawingStatus): Promise<TechnicalDrawingResponse[]> => {
    const params: Record<string, string> = {};
    if (status !== undefined) params.status = String(status);
    try {
      const res = await api.get("/api/technicaldrawing", { params });
      return res.data?.result ?? res.data ?? [];
    } catch {
      return [];
    }
  },

  getById: async (id: string): Promise<TechnicalDrawingResponse> => {
    const res = await api.get(`/api/technicaldrawing/${id}`);
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

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/technicaldrawing/${id}`);
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

  deleteFile: async (id: string, fileId: string): Promise<void> => {
    await api.delete(`/api/technicaldrawing/${id}/files/${fileId}`);
  },

  downloadFileUrl: (id: string, fileId: string): string =>
    `/api/technicaldrawing/${id}/files/${fileId}/download`,
};

// ─── CostNorm ─────────────────────────────────────────────────────────────────

export interface CostNormItemResponse {
  id: string;
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

export interface CostNormResponse {
  id: string;
  contractId: string;
  status: DrawingStatus;
  contractNo: string;
  title: string;
  notes: string | null;
  createdBy: string;
  createdByFullName: string | null;
  createdAt: string;
  items: CostNormItemResponse[];
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
  title: string;
  notes?: string | null;
  items: CostNormItemCreatePayload[];
}

export const costNormService = {
  getAll: async (contractId?: string): Promise<CostNormResponse[]> => {
    const params: Record<string, string> = {};
    if (contractId) params.contractId = contractId;
    try {
      const res = await api.get("/api/costnorm", { params });
      return res.data?.result ?? res.data ?? [];
    } catch {
      return [];
    }
  },

  getById: async (id: string): Promise<CostNormResponse> => {
    const res = await api.get(`/api/costnorm/${id}`);
    return res.data?.result ?? res.data;
  },

  create: async (dto: CostNormCreatePayload): Promise<string> => {
    const res = await api.post("/api/costnorm", dto);
    return res.data?.result as string;
  },

  update: async (id: string, dto: { title?: string; notes?: string | null; items?: CostNormItemCreatePayload[] }): Promise<void> => {
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

  deleteFile: async (id: string, fileId: string): Promise<void> => {
    await api.delete(`/api/costnorm/${id}/files/${fileId}`);
  },

  downloadFile: async (id: string, fileId: string, fileName: string): Promise<void> => {
    const res = await api.get(`/api/costnorm/${id}/files/${fileId}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  },
};

// ─── ContractTask ─────────────────────────────────────────────────────────────

export interface ContractTaskResponse {
  id: string;
  contractId: string;
  orderNo: number;
  name: string;
  completedAmount: number;
  totalAmount: number;
  importance: number;
  percentComplete: number;
  createdBy: string;
  createdByFullName: string | null;
  createdAt: string;
}

export interface ContractTaskCreatePayload {
  contractId: string;
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
}

export interface ContractTaskLogCreatePayload {
  amount: number;
  note?: string;
  date: string; // "YYYY-MM-DD"
}

export interface ContractTaskLogResponse {
  id: string;
  taskId: string;
  amount: number;
  note: string | null;
  date: string;
  createdBy: string;
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
