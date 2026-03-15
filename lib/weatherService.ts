// Serviço simplificado de clima para Next.js
// Versão básica funcional - pode ser expandida depois

const API_KEY = process.env.OPENWEATHER_API_KEY || '';
const BASE_URL = 'https://api.openweathermap.org';

interface CityData {
    name: string;
    country: string;
    state?: string;
    lat: number;
    lon: number;
}

export async function getCityCoordinates(city: string): Promise<CityData | null> {
    try {
        const response = await fetch(
            `${BASE_URL}/geo/1.0/direct?q=${encodeURIComponent(city)}, PT&limit=1&appid=${API_KEY}`
        );
        const data = await response.json();
        
        if (Array.isArray(data) && data.length > 0 && data[0].country === 'PT') {
            return {
                name: data[0].name,
                country: 'PT',
                state: data[0].state || undefined,
                lat: parseFloat(data[0].lat),
                lon: parseFloat(data[0].lon)
            };
        }
        return null;
    } catch (error) {
        console.error('Erro ao obter coordenadas:', error);
        return null;
    }
}

export async function getForecast(lat: number, lon: number, days: number): Promise<any> {
    try {
        const response = await fetch(
            `${BASE_URL}/data/2.5/forecast?lat=${lat}&lon=${lon}&cnt=${Math.min(days * 8, 40)}&units=metric&lang=pt&appid=${API_KEY}`
        );
        const data = await response.json();
        return data.list || [];
    } catch (error) {
        console.error('Erro ao obter previsão:', error);
        throw error;
    }
}

// Funções auxiliares para cálculos solares (simplificadas)
export function calculateSunTime(lat: number, lon: number, date: Date, isSunrise: boolean): Date {
    const latRad = (lat * Math.PI) / 180;
    const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
    const declination = 23.45 * Math.sin((360 * (284 + dayOfYear) / 365) * Math.PI / 180);
    const declinationRad = (declination * Math.PI) / 180;
    const zenith = 90.833;
    const zenithRad = (zenith * Math.PI) / 180;
    
    const hourAngle = Math.acos(
        (Math.cos(zenithRad) - Math.sin(latRad) * Math.sin(declinationRad)) /
        (Math.cos(latRad) * Math.cos(declinationRad))
    );
    
    const time = isSunrise
        ? 12 - (hourAngle * 180 / Math.PI) / 15
        : 12 + (hourAngle * 180 / Math.PI) / 15;
    
    time += lon / 15;
    
    const hours = Math.floor(time);
    const minutes = Math.floor((time - hours) * 60);
    
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
}

export function formatTime(date: Date): string {
    return date.toTimeString().slice(0, 5);
}
