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
            // Manhã: Blue Hour antes, Golden Hour depois; Blue Hour termina poucos minutos antes do nascer
            const blueHourMorningStart = new Date(sunrise.getTime() - 90 * 60 * 1000); // 1h30 antes
            const blueHourMorningEnd = new Date(sunrise.getTime() - 8 * 60 * 1000);   // 8 min antes do nascer
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
                    distribution: {
                        pattern: avgClouds < 20 ? 'dispersas' : avgClouds < 50 ? 'parcial' : 'abundante',
                        description: avgClouds < 20 ? 'Céu limpo - ideal para sol direto' : avgClouds < 50 ? 'Nuvens interessantes para pôr/nascer' : 'Céu carregado - foco em primeiro plano',
                        horizon_concentration: avgClouds < 20 ? 'muito baixa' : avgClouds < 40 ? 'baixa' : avgClouds < 60 ? 'média' : 'alta'
                    },
                    concentration: avgClouds < 20 ? 'muito baixa' : avgClouds < 40 ? 'baixa' : avgClouds < 60 ? 'média' : avgClouds < 80 ? 'alta' : 'muito alta',
                    concentration_photo_tip: avgClouds < 20 ? 'Céu limpo - concentração mínima; bom para sol limpo e sombras definidas' : avgClouds < 40 ? 'Concentração baixa - nuvens isoladas ideais para pôr/nascer do sol' : avgClouds < 60 ? 'Concentração média - bom equilíbrio para drama no céu' : 'Concentração alta - priorize primeiro plano ou detalhes',
                    movement_prediction: avgWindSpeed < 5 ? 'lento' : avgWindSpeed < 15 ? 'moderado' : 'rápido',
                    movement_speed: Math.round(avgWindSpeed * 3.6),
                    movement_direction: items[0].wind?.deg ? degreesToCardinal(items[0].wind.deg) : 'N/A',
                    movement_description: avgWindSpeed < 5 ? 'Nuvens quase estáticas - ideal para composições longas' : 
                                         avgWindSpeed < 15 ? 'Movimento moderado - bom para timelapse' : 
                                         'Movimento rápido - nuvens dramáticas, timelapse interessante',
                    movement: {
                        speed: `${Math.round(avgWindSpeed * 3.6)} km/h`,
                        description: avgWindSpeed < 5 ? 'Nuvens quase estáticas - ideal para composições longas' : avgWindSpeed < 15 ? 'Movimento moderado - bom para timelapse' : 'Movimento rápido - nuvens dramáticas, timelapse interessante'
                    }
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
                    // Espelhagem: 23 km/h ≈ 6.4 m/s → razoável/limitada; tier fino para fotografia
                    mirror_quality: avgWindSpeed < 2 ? 'excelente' : avgWindSpeed < 4 ? 'muito boa' : avgWindSpeed < 6 ? 'boa' : avgWindSpeed < 8 ? 'razoável' : avgWindSpeed < 12 ? 'má' : 'muito má',
                    mirror_description: avgWindSpeed < 2 ? 'Água calma - perfeita para espelhagem' : 
                                     avgWindSpeed < 4 ? 'Condições muito boas para espelhagem' :
                                     avgWindSpeed < 6 ? 'Condições moderadas - espelhagem possível' :
                                     avgWindSpeed < 8 ? 'Vento 20-30 km/h - espelhagem limitada, ondas pequenas' :
                                     avgWindSpeed < 12 ? 'Vento moderado - espelhagem difícil' :
                                     'Vento forte - espelhagem impraticável',
                    wind_for_water: { speed: Math.round(avgWindSpeed * 3.6) },
                    water_fog_risk: avgHumidity > 85 ? 'alto' : 'baixo',
                    recommendation: avgWindSpeed < 2 ? 'Ideal para fotos de espelhagem' : 
                                  avgWindSpeed < 4 ? 'Bom para espelhagem' :
                                  avgWindSpeed < 6 ? 'Espelhagem possível com paciência' :
                                  avgWindSpeed < 8 ? 'Espelhagem limitada (ex.: ~23 km/h) - prefira ângulos baixos ou momentos de menor vento' :
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
                            type: avgClouds < 30 ? 'grande angular (14-24mm)' : avgClouds >= 20 && avgClouds <= 50 ? 'grande angular (16-35mm)' : 'normal (24-70mm)',
                            reason: avgClouds < 30 ? 'Céu limpo - ideal para paisagens amplas' : 
                                   avgClouds >= 20 && avgClouds <= 50 ? 'Nuvens interessantes - grande angular captura mais céu' :
                                   'Condições variadas',
                            priority: 'alta'
                        },
                        alternatives: avgClouds >= 20 && avgClouds <= 50 ? [
                            'Teleobjetiva (70-200mm) para detalhes de nuvens',
                            'Ultra grande angular (10-14mm) para vistas dramáticas'
                        ] : avgClouds < 20 ? [
                            'Teleobjetiva (100-400mm) para comprimir elementos distantes',
                            'Normal (50mm) para composições equilibradas'
                        ] : [
                            'Normal (24-70mm) versátil',
                            'Teleobjetiva (70-200mm) para isolamento de elementos'
                        ],
                        framing_tips: avgClouds < 30 ? [
                            'Use regra dos terços - coloque horizonte no terço inferior',
                            'Inclua elementos em primeiro plano para profundidade',
                            'Aproveite o céu limpo para composições minimalistas'
                        ] : avgClouds >= 20 && avgClouds <= 50 ? [
                            'Céu dramático - dê mais espaço ao céu (2/3 da imagem)',
                            'Nuvens no horizonte criam interesse - enquadre baixo',
                            'Use nuvens como elemento de composição'
                        ] : [
                            'Céu nublado - foque em elementos terrestres',
                            'Use nuvens baixas para criar atmosfera',
                            'Considere composições verticais para capturar altura das nuvens'
                        ]
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
                        } : avgWindSpeed >= 6 && avgWindSpeed < 10 ? {
                            type: 'ND (3–6 stops) ou polarizador',
                            reason: 'Vento moderado (20–35 km/h) - ND para suavizar água, polarizador para contraste',
                            priority: 'média'
                        } : null,
                        alternatives: avgClouds < 20 ? ['Polarizador para reduzir brilho', 'ND gradiente para nascer/pôr do sol'] : 
                                     avgWindSpeed < 5 ? ['ND gradiente para equilibrar céu e terra', 'Polarizador para espelhagem'] :
                                     avgWindSpeed < 10 ? ['ND para longa exposição na água', 'Polarizador para cortar reflexos'] : [],
                        note: avgClouds < 20 ? 'ND recomendado, polarizador útil' :
                             avgWindSpeed < 5 ? 'Polarizador recomendado para água' :
                             avgWindSpeed < 10 ? 'ND ou polarizador conforme tipo de plano (água vs. céu)' :
                             'Filtros opcionais'
                    },
                    camera_settings: {
                        iso: avgClouds < 20 ? {
                            base: 100,
                            range: '100-400',
                            reason: 'Céu claro - ISO baixo para máxima qualidade',
                            note: 'Use ISO 100-200 para melhor qualidade, aumente apenas se necessário'
                        } : avgClouds < 50 ? {
                            base: 200,
                            range: '200-800',
                            reason: 'Condições variadas - ISO moderado',
                            note: 'ISO 200-400 ideal, aumente para 800 se houver movimento'
                        } : {
                            base: 400,
                            range: '400-1600',
                            reason: 'Céu nublado - ISO mais alto para compensar luz',
                            note: 'ISO 400-800 base, até 1600 se necessário para velocidade'
                        },
                        aperture: avgClouds < 20 ? {
                            recommended: 'f/8 - f/11',
                            reason: 'Máxima nitidez e profundidade de campo',
                            alternatives: ['f/5.6 para isolamento', 'f/16 para máxima profundidade'],
                            note: 'f/8 é o ponto ideal para grande angular'
                        } : avgClouds >= 20 && avgClouds <= 50 ? {
                            recommended: 'f/8 - f/11',
                            reason: 'Equilíbrio entre nitidez e exposição',
                            alternatives: ['f/5.6 para mais luz', 'f/13 para mais profundidade'],
                            note: 'f/8-11 ideal para paisagens com nuvens'
                        } : {
                            recommended: 'f/5.6 - f/8',
                            reason: 'Mais luz para compensar céu nublado',
                            alternatives: ['f/4 para mais luz', 'f/11 para mais profundidade'],
                            note: 'Ajuste conforme necessidade de luz'
                        },
                        shutter_speed: avgWindSpeed < 2 ? {
                            recommended: '1/30s - 30s',
                            reason: 'Vento calmo - longas exposições possíveis',
                            long_exposure: '30s - 5min para água suave',
                            normal: '1/30s - 1/2s para movimento suave',
                            fast: '1/125s+ para congelar movimento',
                            note: 'Use tripé para exposições > 1/30s'
                        } : avgWindSpeed < 5 ? {
                            recommended: '1/60s - 2s',
                            reason: 'Vento leve - exposições moderadas',
                            long_exposure: '2s - 30s possível com tripé estável',
                            normal: '1/60s - 1/4s para movimento controlado',
                            fast: '1/250s+ para congelar',
                            note: 'Tripé recomendado para exposições > 1/60s'
                        } : avgWindSpeed < 15 ? {
                            recommended: '1/125s - 1/2s',
                            reason: 'Vento moderado - velocidades mais altas',
                            long_exposure: '1/2s - 4s máximo',
                            normal: '1/125s - 1/30s',
                            fast: '1/500s+ para congelar movimento',
                            note: 'Evite exposições muito longas com vento'
                        } : {
                            recommended: '1/250s+',
                            reason: 'Vento forte - velocidades altas necessárias',
                            long_exposure: 'Não recomendado',
                            normal: '1/250s - 1/500s',
                            fast: '1/500s+ para congelar',
                            note: 'Use velocidades altas para evitar movimento'
                        }
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
    // Usar UTC para ser consistente em qualquer servidor (azimute/elevação usam getUTCHours)
    result.setUTCHours(hours, minutes, 0, 0);
    return result;
}

function formatTime(date) {
    const h = date.getUTCHours();
    const m = date.getUTCMinutes();
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function calculateSunAzimuth(lat, lon, date) {
    const latRad = (lat * Math.PI) / 180;
    const dayOfYear = Math.floor((date.getTime() - new Date(Date.UTC(date.getUTCFullYear(), 0, 0)).getTime()) / 86400000);
    const declination = 23.45 * Math.sin((360 * (284 + dayOfYear) / 365) * Math.PI / 180);
    const declinationRad = (declination * Math.PI) / 180;
    
    // Hora solar local: usar UTC para ser independente do fuso do servidor
    const hoursUTC = date.getUTCHours() + date.getUTCMinutes() / 60;
    const solarTime = hoursUTC + (lon / 15);
    const hourAngle = (solarTime - 12) * 15;
    const hourAngleRad = (hourAngle * Math.PI) / 180;
    
    // Azimute (fórmula solar): resultado é referido a Sul; +180° para Norte (0°=N, 90°=E)
    const azimuthRad = Math.atan2(
        Math.sin(hourAngleRad),
        Math.cos(hourAngleRad) * Math.sin(latRad) - Math.tan(declinationRad) * Math.cos(latRad)
    );
    let azimuth = (azimuthRad * 180) / Math.PI + 180;
    azimuth = (azimuth + 360) % 360;
    
    return azimuth;
}

function calculateSunElevation(lat, lon, date) {
    const latRad = (lat * Math.PI) / 180;
    const dayOfYear = Math.floor((date.getTime() - new Date(Date.UTC(date.getUTCFullYear(), 0, 0)).getTime()) / 86400000);
    const declination = 23.45 * Math.sin((360 * (284 + dayOfYear) / 365) * Math.PI / 180);
    const declinationRad = (declination * Math.PI) / 180;
    
    // Hora solar local: usar UTC para ser independente do fuso do servidor
    const hoursUTC = date.getUTCHours() + date.getUTCMinutes() / 60;
    const solarTime = hoursUTC + (lon / 15);
    const hourAngle = (solarTime - 12) * 15;
    const hourAngleRad = (hourAngle * Math.PI) / 180;
    
    const elevationRad = Math.asin(
        Math.sin(latRad) * Math.sin(declinationRad) +
        Math.cos(latRad) * Math.cos(declinationRad) * Math.cos(hourAngleRad)
    );
    const elevation = (elevationRad * 180) / Math.PI;
    
    // Refração atmosférica no horizonte ~0,83° (sol geometricamente -0,83° aparece a 0°)
    return elevation + 0.83;
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
