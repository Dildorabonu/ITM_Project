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

  update: async (id: string, dto: ProductUpdatePayload): Promise<void> => {
    await api.put(`/api/product/${id}`, dto);
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/product/${id}`);
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
