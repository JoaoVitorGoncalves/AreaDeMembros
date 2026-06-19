export interface Role {
    id: number;
    uuid: string;
    name: string;
    invite_token?: string;
    description?: string;
    active?: boolean;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string | null;
    users_count?: number;
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