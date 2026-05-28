export interface Support {
    phone: string;
    email: string;
}

export interface SupportResponse {
    success: boolean;
    message: string;
    data: Support;
} 