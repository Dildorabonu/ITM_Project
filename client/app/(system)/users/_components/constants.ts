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
