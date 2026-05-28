export interface Role {
    id: number;
    uuid: string;
    name: string;
    custom_url: string;
    description?: string;
    active?: boolean;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string | null;
    users_count?: number; // Novo campo para contagem de usuários
}

export interface RolesResponse {
    success: boolean;
    data: {
        roles: Role[];
        total_roles: number;
    };
    message: string;
    timestamp: string;
} 