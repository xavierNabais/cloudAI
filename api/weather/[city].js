// Vercel Serverless Function para previsão do tempo
export default async function handler(req, res) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Extrair parâmetros da URL
    // Para Vercel: req.url contém o path completo
    const url = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const city = pathParts[pathParts.length - 1] || url.searchParams.get('city');
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days')) || 5, 1), 7);

    if (!city) {
        return res.status(400).json({ error: 'City parameter is required' });
    }

    try {
        const apiKey = process.env.OPENWEATHER_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'API key not configured' });
        }

        // Obter coordenadas da cidade
        const geoResponse = await fetch(
            `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}, PT&limit=1&appid=${apiKey}`
        );
        const geoData = await geoResponse.json();
        
        if (!Array.isArray(geoData) || geoData.length === 0 || geoData[0].country !== 'PT') {
            return res.status(404).json({ error: `Cidade '${city}' não encontrada em Portugal` });
        }

        const cityData = geoData[0];
        const lat = parseFloat(cityData.lat);
        const lon = parseFloat(cityData.lon);

        // Obter previsão
        const forecastResponse = await fetch(
            `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&cnt=${Math.min(days * 8, 40)}&units=metric&lang=pt&appid=${apiKey}`
        );
        
        if (!forecastResponse.ok) {
            const errorData = await forecastResponse.json().catch(() => ({}));
            throw new Error(errorData.message || `Erro HTTP ${forecastResponse.status} ao obter previsão`);
        }
        
        const forecastData = await forecastResponse.json();

        if (!forecastData || !forecastData.list || !Array.isArray(forecastData.list)) {
            console.error('Resposta inválida da API:', forecastData);
            throw new Error('Resposta da API inválida: lista de previsões não encontrada');
        }

        // Processar dados (versão simplificada)
        const dailyData = {};
        forecastData.list.forEach(item => {
            const date = new Date(item.dt * 1000).toISOString().split('T')[0];
            if (!dailyData[date]) {
                dailyData[date] = [];
            }
            dailyData[date].push(item);
        });

        const forecast = [];
        let count = 0;
        const sortedDates = Object.keys(dailyData).sort();
        
        for (const date of sortedDates) {
            if (count >= days) break;
            const items = dailyData[date];
            
            if (!items || !Array.isArray(items) || items.length === 0) {
                continue;
            }

            // Calcular médias
            const clouds = items.map(i => i.clouds?.all || 0);
            const avgClouds = clouds.reduce((a, b) => a + b, 0) / clouds.length;
            const avgTemp = items.reduce((sum, i) => sum + (i.main?.temp || 0), 0) / items.length;
            const avgWindSpeed = items.reduce((sum, i) => sum + (i.wind?.speed || 0), 0) / items.length;
            const avgVisibility = items.reduce((sum, i) => sum + (i.visibility || 10000), 0) / items.length / 1000;
            const avgHumidity = items.reduce((sum, i) => sum + (i.main?.humidity || 0), 0) / items.length;

            // Calcular horários do sol
            const dateObj = new Date(date);
            const sunrise = calculateSunTime(lat, lon, dateObj, true);
            const sunset = calculateSunTime(lat, lon, dateObj, false);

            // Calcular azimute e elevação do sol
            const sunriseAzimuth = calculateSunAzimuth(lat, lon, sunrise);
            const sunsetAzimuth = calculateSunAzimuth(lat, lon, sunset);
            const sunriseElevation = calculateSunElevation(lat, lon, sunrise);
            const sunsetElevation = calculateSunElevation(lat, lon, sunset);

            // Blue Hour e Golden Hour - ordem correta sem sobreposição
            // Manhã: Blue Hour antes, Golden Hour depois (termina no nascer)
            const blueHourMorningStart = new Date(sunrise.getTime() - 90 * 60 * 1000); // 1h30 antes
            const blueHourMorningEnd = new Date(sunrise.getTime() - 30 * 60 * 1000); // 30min antes
            const goldenHourMorningStart = new Date(sunrise.getTime() - 60 * 60 * 1000); // 1h antes
            const goldenHourMorningEnd = sunrise; // Termina no nascer

            // Tarde: Golden Hour antes (começa antes do pôr), Blue Hour depois (começa no pôr)
            const goldenHourEveningStart = new Date(sunset.getTime() - 60 * 60 * 1000); // 1h antes
            const goldenHourEveningEnd = sunset; // Termina no pôr
            const blueHourEveningStart = sunset; // Começa no pôr
            const blueHourEveningEnd = new Date(sunset.getTime() + 30 * 60 * 1000); // 30min depois

            // Avaliar condições
            let photographyStatus = 'razoavel';
            if (avgClouds >= 20 && avgClouds <= 40 && avgWindSpeed < 5 && avgVisibility >= 10) {
                photographyStatus = 'excelente';
            } else if (avgClouds >= 20 && avgClouds <= 50 && avgWindSpeed < 10) {
                photographyStatus = 'bom';
            } else if (avgClouds > 70 || avgWindSpeed > 15) {
                photographyStatus = 'mau';
            }

            forecast.push({
                date,
                description: items[0]?.weather?.[0]?.description || 'Sem descrição',
                temperature: Math.round(avgTemp * 10) / 10,
                clouds: Math.round(avgClouds),
                cloud_details: {
                    type: avgClouds < 20 ? 'limpo' : avgClouds < 50 ? 'cumulus' : 'stratus',
                    height: avgClouds < 30 ? 'alta' : avgClouds < 70 ? 'média' : 'baixa',
                    description: avgClouds < 20 ? 'Céu limpo' : 'Nuvens variadas',
                    coverage_percent: Math.round(avgClouds),
                    distribution: avgClouds < 20 ? 'dispersas' : avgClouds < 50 ? 'parcial' : 'abundante',
                    movement_prediction: avgWindSpeed < 5 ? 'lento' : avgWindSpeed < 15 ? 'moderado' : 'rápido'
                },
                wind_speed: Math.round(avgWindSpeed * 3.6 * 10) / 10,
                wind_direction: items[0].wind?.deg ? {
                    degrees: Math.round(items[0].wind.deg),
                    cardinal: degreesToCardinal(items[0].wind.deg),
                    arrow: getWindArrow(items[0].wind.deg)
                } : null,
                visibility: Math.round(avgVisibility * 10) / 10,
                humidity: Math.round(avgHumidity),
                pressure: items[0].main?.pressure ? Math.round(items[0].main.pressure) : null,
                sun_info: {
                    sunrise: formatTime(sunrise),
                    sunset: formatTime(sunset),
                    golden_hour: {
                        morning: {
                            start: formatTime(goldenHourMorningStart),
                            end: formatTime(goldenHourMorningEnd)
                        },
                        evening: {
                            start: formatTime(goldenHourEveningStart),
                            end: formatTime(goldenHourEveningEnd)
                        }
                    },
                    blue_hour: {
                        morning: {
                            start: formatTime(blueHourMorningStart),
                            end: formatTime(blueHourMorningEnd)
                        },
                        evening: {
                            start: formatTime(blueHourEveningStart),
                            end: formatTime(blueHourEveningEnd)
                        }
                    },
                    sunrise_azimuth: Math.round(sunriseAzimuth),
                    sunset_azimuth: Math.round(sunsetAzimuth),
                    sunrise_elevation: Math.round(sunriseElevation * 10) / 10,
                    sunset_elevation: Math.round(sunsetElevation * 10) / 10,
                    sunrise_direction: degreesToCardinal(sunriseAzimuth),
                    sunset_direction: degreesToCardinal(sunsetAzimuth)
                },
                atmospheric: {
                    humidity: Math.round(avgHumidity),
                    humidity_risk: avgHumidity > 85 ? 'alto' : avgHumidity > 70 ? 'médio' : 'baixo',
                    pressure: items[0].main?.pressure || 1013,
                    fog_mist: avgHumidity > 90,
                    fog_intensity: avgHumidity > 90 ? 'moderado' : 'nenhum',
                    precipitation: {
                        total: 0,
                        type: 'nenhuma',
                        intensity: 'nenhuma'
                    }
                },
                water_conditions: {
                    mirror_quality: avgWindSpeed < 2 ? 'excelente' : avgWindSpeed < 5 ? 'muito boa' : avgWindSpeed < 10 ? 'boa' : avgWindSpeed < 15 ? 'razoável' : 'má',
                    mirror_description: avgWindSpeed < 2 ? 'Água calma - perfeita para espelhagem' : 
                                     avgWindSpeed < 5 ? 'Condições muito boas para espelhagem' :
                                     avgWindSpeed < 10 ? 'Condições moderadas - espelhagem possível' :
                                     avgWindSpeed < 15 ? 'Vento moderado - espelhagem limitada' :
                                     'Vento forte - espelhagem difícil',
                    wind_for_water: { speed: Math.round(avgWindSpeed * 3.6) },
                    water_fog_risk: avgHumidity > 85 ? 'alto' : 'baixo',
                    recommendation: avgWindSpeed < 2 ? 'Ideal para fotos de espelhagem' : 
                                  avgWindSpeed < 5 ? 'Bom para espelhagem' :
                                  avgWindSpeed < 10 ? 'Espelhagem possível com paciência' :
                                  'Espelhagem difícil - considere outras composições'
                },
                photometry: {
                    light_scattering: {
                        index: avgClouds >= 20 && avgClouds <= 40 ? 75 : avgClouds < 20 ? 50 : 30,
                        description: 'Dispersão moderada',
                        quality: 'boa'
                    },
                    brightness: {
                        level: avgClouds < 20 ? 'alta' : avgClouds < 40 ? 'média-alta' : 'média',
                        description: 'Brilho adequado'
                    },
                    contrast: {
                        level: avgClouds >= 20 && avgClouds <= 40 ? 'alto' : 'médio',
                        description: 'Contraste adequado'
                    },
                    color_intensity: avgClouds >= 20 && avgClouds <= 40 ? 'alta' : 'moderada'
                },
                equipment_suggestions: {
                    lens: {
                        primary: {
                            type: avgClouds < 30 ? 'grande angular' : avgClouds >= 20 && avgClouds <= 50 ? 'grande angular' : 'normal',
                            reason: avgClouds < 30 ? 'Céu limpo - ideal para paisagens amplas' : 
                                   avgClouds >= 20 && avgClouds <= 50 ? 'Nuvens interessantes - grande angular captura mais céu' :
                                   'Condições variadas',
                            priority: 'alta'
                        }
                    },
                    tripod: {
                        recommended: avgWindSpeed < 3 || avgWindSpeed > 10,
                        priority: avgWindSpeed < 3 ? 'alta' : avgWindSpeed > 10 ? 'média' : 'baixa',
                        reasons: avgWindSpeed < 3 ? ['Vento calmo permite longas exposições'] : 
                                avgWindSpeed > 10 ? ['Vento forte - tripé ajuda estabilizar'] : [],
                        note: avgWindSpeed < 3 ? 'Tripé altamente recomendado' : 
                             avgWindSpeed > 10 ? 'Tripé recomendado para estabilidade' :
                             'Tripé opcional'
                    },
                    filters: {
                        primary: avgClouds < 20 ? {
                            type: 'ND (Neutral Density)',
                            reason: 'Céu muito brilhante - reduz exposição',
                            priority: 'alta'
                        } : avgWindSpeed < 5 && avgClouds >= 20 ? {
                            type: 'Polarizador',
                            reason: 'Melhora contraste e reduz reflexos na água',
                            priority: 'média'
                        } : null,
                        alternatives: avgClouds < 20 ? ['Polarizador para reduzir brilho'] : 
                                     avgWindSpeed < 5 ? ['ND gradiente para equilibrar céu e terra'] : [],
                        note: avgClouds < 20 ? 'ND recomendado, polarizador útil' :
                             avgWindSpeed < 5 ? 'Polarizador recomendado para água' :
                             'Filtros opcionais'
                    }
                },
                photography_status: photographyStatus,
                photography_notes: `Condições ${photographyStatus} para fotografia. Nuvens: ${Math.round(avgClouds)}%, Vento: ${Math.round(avgWindSpeed * 3.6)} km/h`
            });

            count++;
        }

        return res.status(200).json({
            city: cityData.name,
            country: cityData.country,
            forecast: Array.isArray(forecast) ? forecast : []
        });
    } catch (error) {
        console.error('Erro ao obter previsão:', error);
        console.error('Stack:', error.stack);
        return res.status(500).json({ 
            error: true,
            message: error.message || 'Erro ao obter previsão do tempo',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

function calculateSunTime(lat, lon, date, isSunrise) {
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
    
    let time = isSunrise
        ? 12 - (hourAngle * 180 / Math.PI) / 15
        : 12 + (hourAngle * 180 / Math.PI) / 15;
    
    time += lon / 15;
    
    const hours = Math.floor(time);
    const minutes = Math.floor((time - hours) * 60);
    
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
}

function formatTime(date) {
    return date.toTimeString().slice(0, 5);
}

function degreesToCardinal(degrees) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
}

function getWindArrow(degrees) {
    const cardinal = degreesToCardinal(degrees);
    const arrows = {
        'N': '⬆️', 'NNE': '⬆️', 'NE': '↗️', 'ENE': '➡️',
        'E': '➡️', 'ESE': '➡️', 'SE': '↘️', 'SSE': '⬇️',
        'S': '⬇️', 'SSW': '⬇️', 'SW': '↙️', 'WSW': '⬅️',
        'W': '⬅️', 'WNW': '↖️', 'NW': '↖️', 'NNW': '⬆️'
    };
    return arrows[cardinal] || '➡️';
}
