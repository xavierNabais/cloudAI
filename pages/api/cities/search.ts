import type { NextApiRequest, NextApiResponse } from 'next';

const PORTUGUESE_CITIES = [
    'Lisboa', 'Porto', 'Braga', 'Coimbra', 'Faro', 'Évora', 'Aveiro', 'Setúbal',
    'Viseu', 'Leiria', 'Funchal', 'Ponta Delgada', 'Vila Nova de Gaia', 'Guimarães',
    'Santarém', 'Bragança', 'Beja', 'Portalegre', 'Viana do Castelo', 'Vila Real',
    'Castelo Branco', 'Angra do Heroísmo', 'Horta', 'Cascais', 'Sintra', 'Almada',
    'Amadora', 'Oeiras', 'Barreiro', 'Seixal', 'Gondomar', 'Matosinhos', 'Maia',
    'Vila do Conde', 'Póvoa de Varzim', 'Esposende', 'Caminha', 'Valença', 'Monção',
    'Melgaço', 'Arcos de Valdevez', 'Ponte de Lima', 'Covilhã', 'Guarda', 'Lamego',
    'Olhão', 'Penafiel', 'Portimão', 'Quarteira', 'Tavira', 'Tomar', 'Torres Vedras'
];

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const query = req.query.q as string;
    
    if (!query || query.length < 2) {
        return res.json([]);
    }

    try {
        const apiKey = process.env.OPENWEATHER_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'API key not configured' });
        }

        // Busca local primeiro
        const lowerQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const localResults = PORTUGUESE_CITIES
            .filter(city => {
                const normalized = city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                return normalized.includes(lowerQuery);
            })
            .slice(0, 10)
            .map(city => ({
                name: city,
                country: 'PT',
                state: null,
                local: true
            }));

        // Busca na API se query tem 3+ caracteres
        let apiResults: any[] = [];
        if (query.length >= 3) {
            try {
                const response1 = await fetch(
                    `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}, Portugal&limit=10&appid=${apiKey}`
                );
                const data1 = await response1.json();
                
                if (Array.isArray(data1)) {
                    apiResults = data1
                        .filter((city: any) => city.country === 'PT')
                        .map((city: any) => ({
                            name: city.name,
                            country: 'PT',
                            state: city.state || null,
                            lat: parseFloat(city.lat),
                            lon: parseFloat(city.lon)
                        }));
                }

                // Se não encontrou suficientes, tentar busca mais ampla
                if (apiResults.length < 5) {
                    const response2 = await fetch(
                        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=15&appid=${apiKey}`
                    );
                    const data2 = await response2.json();
                    
                    if (Array.isArray(data2)) {
                        const additional = data2
                            .filter((city: any) => 
                                city.country === 'PT' && 
                                !apiResults.some(r => r.name === city.name)
                            )
                            .map((city: any) => ({
                                name: city.name,
                                country: 'PT',
                                state: city.state || null,
                                lat: parseFloat(city.lat),
                                lon: parseFloat(city.lon)
                            }));
                        apiResults = [...apiResults, ...additional];
                    }
                }
            } catch (err) {
                console.error('Erro ao buscar cidades na API:', err);
            }
        }

        // Combinar resultados
        const combined = [...localResults];
        apiResults.forEach(apiCity => {
            if (!combined.some(c => c.name.toLowerCase() === apiCity.name.toLowerCase())) {
                combined.push(apiCity);
            }
        });

        // Ordenar por relevância
        combined.sort((a, b) => {
            const aStarts = a.name.toLowerCase().startsWith(lowerQuery);
            const bStarts = b.name.toLowerCase().startsWith(lowerQuery);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return a.name.localeCompare(b.name);
        });

        return res.json(combined.slice(0, 10));
    } catch (error: any) {
        console.error('Erro ao buscar cidades:', error);
        return res.status(500).json({ error: 'Erro ao buscar cidades' });
    }
}
