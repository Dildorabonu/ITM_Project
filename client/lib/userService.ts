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
  createdAt: string;
}

export interface UserCreatePayload {
  firstName: string;
  lastName: string;
  login: string;
  password: string;
  roleId: string | null;
  departmentId: string | null;
}

export interface UserUpdatePayload {
  firstName?: string;
  lastName?: string;
  login?: string;
  password?: string;
  roleId?: string | null;
  departmentId?: string | null;
  isActive?: boolean;
}

export interface RoleOption {
  id: string;
  name: string;
}

export interface DepartmentOption {
  id: string;
  name: string;
}

export const userService = {
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
  createdAt: string;
}

export interface RoleCreatePayload {
  name: string;
  description?: string;
}

export interface RoleUpdatePayload {
  name?: string;
  description?: string;
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
  getAll: async (): Promise<RoleOption[]> => {
    const res = await api.get("/api/role");
    const data = res.data?.result ?? res.data ?? [];
    return data.map((r: { id: string; name: string }) => ({ id: r.id, name: r.name }));
  },

  getAllFull: async (): Promise<RoleResponse[]> => {
    const res = await api.get("/api/role");
    return res.data?.result ?? res.data ?? [];
  },

  create: async (dto: RoleCreatePayload): Promise<void> => {
    await api.post("/api/role", dto);
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
  headUserId: string | null;
  headUserFullName: string | null;
  employeeCount: number;
  createdAt: string;
}

export interface DepartmentCreatePayload {
  name: string;
  headUserId?: string | null;
  employeeCount?: number;
}

export interface DepartmentUpdatePayload {
  name?: string;
  headUserId?: string | null;
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
  Active = 1,
  Completed = 2,
  Cancelled = 3,
}

export enum Priority {
  Low = 0,
  Medium = 1,
  High = 2,
  Urgent = 3,
}

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  [ContractStatus.Draft]:     "Qoralama",
  [ContractStatus.Active]:    "Faol",
  [ContractStatus.Completed]: "Yakunlandi",
  [ContractStatus.Cancelled]: "Bekor qilindi",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  [Priority.Low]:    "Past",
  [Priority.Medium]: "O'rta",
  [Priority.High]:   "Yuqori",
  [Priority.Urgent]: "Shoshilinch",
};

export interface ContractResponse {
  id: string;
  contractNo: string;
  clientName: string;
  productType: string;
  quantity: number;
  unit: string;
  startDate: string;
  endDate: string;
  departmentId: string;
  departmentName: string | null;
  priority: Priority;
  status: ContractStatus;
  notes: string | null;
  createdBy: string;
  createdByFullName: string | null;
  createdAt: string;
}

export interface ContractCreatePayload {
  contractNo: string;
  clientName?: string;
  productType?: string;
  quantity?: number;
  unit?: string;
  startDate: string;
  endDate: string;
  departmentId?: string;
  priority: Priority;
  notes?: string | null;
}

export interface ContractUpdatePayload {
  contractNo?: string;
  clientName?: string;
  productType?: string;
  quantity?: number;
  unit?: string;
  startDate?: string;
  endDate?: string;
  departmentId?: string;
  priority?: Priority;
  notes?: string | null;
}

export const contractService = {
  getAll: async (status?: ContractStatus, departmentId?: string): Promise<ContractResponse[]> => {
    const params: Record<string, string> = {};
    if (status !== undefined) params.status = String(status);
    if (departmentId) params.departmentId = departmentId;
    const res = await api.get("/api/contract", { params });
    return res.data?.result ?? res.data ?? [];
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
};

export const departmentService = {
  getAll: async (): Promise<DepartmentOption[]> => {
    const res = await api.get("/api/department");
    const data = res.data?.result ?? res.data ?? [];
    return data.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name }));
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
