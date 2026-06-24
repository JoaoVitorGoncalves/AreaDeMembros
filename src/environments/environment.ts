export const environment = {
    production: false,
    apiUrl: (typeof window !== 'undefined' && window.location.hostname === 'localhost')
        ? 'http://localhost:8000'
        : 'https://videodashboardapigiovani.ignorelist.com'
}; 