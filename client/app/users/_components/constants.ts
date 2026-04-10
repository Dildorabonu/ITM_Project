import { DepartmentType } from "@/lib/userService";

export const emptyForm = {
  firstName: "",
  lastName: "",
  login: "",
  password: "",
  roleId: "",
  departmentId: "",
  isActive: true,
  isHead: false,
};

export const TYPE_STYLE = {
  [DepartmentType.IshlabChiqarish]: { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa", icon: "🏭" },
  [DepartmentType.Bolim]:           { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", icon: "🏢" },
  [DepartmentType.Boshqaruv]:       { bg: "#f5f3ff", color: "#6d28d9", border: "#ddd6fe", icon: "👔" },
};

export type UserForm = {
  firstName: string;
  lastName: string;
  login: string;
  password: string;
  roleId: string;
  departmentId: string;
  isActive: boolean;
  isHead: boolean;
};
