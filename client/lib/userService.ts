import { api } from "./api";

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
  getAll: async (): Promise<UserResponse[]> => {
    const res = await api.get("/api/user");
    return res.data?.result ?? res.data ?? [];
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

export interface PermissionResponse {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface PermissionCreatePayload {
  name: string;
  description?: string;
}

export interface PermissionUpdatePayload {
  name?: string;
  description?: string;
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
};

export const permissionService = {
  getAll: async (): Promise<PermissionResponse[]> => {
    const res = await api.get("/api/permission");
    return res.data?.result ?? res.data ?? [];
  },

  create: async (dto: PermissionCreatePayload): Promise<void> => {
    await api.post("/api/permission", dto);
  },

  update: async (id: string, dto: PermissionUpdatePayload): Promise<void> => {
    await api.put(`/api/permission/${id}`, dto);
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/permission/${id}`);
  },
};

export const departmentService = {
  getAll: async (): Promise<DepartmentOption[]> => {
    const res = await api.get("/api/department");
    const data = res.data?.result ?? res.data ?? [];
    return data.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name }));
  },
};
