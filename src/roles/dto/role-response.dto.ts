export class RoleResponseDto {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  permissions?: Record<string, boolean>;
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
}
