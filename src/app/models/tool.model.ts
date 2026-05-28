export interface Tool {
    id: number;
    uuid: string;
    name: string;
    description: string;
    image_url: string;
    link: string;
}

export interface ToolsResponseData {
    tools: Tool[];
    total_tools: number;
}

export interface ToolsResponse {
    success: boolean;
    message: string;
    timestamp: string;
    data: ToolsResponseData;
} 