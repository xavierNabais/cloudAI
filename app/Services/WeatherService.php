<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class WeatherService
{
    protected $apiKey;
    protected $baseUrl = 'https://api.openweathermap.org';

    public function __construct()
    {
        $this->apiKey = env('OPENWEATHER_API_KEY');
        
        if (empty($this->apiKey)) {
            throw new \Exception('OPENWEATHER_API_KEY não configurada no .env');
        }
    }

    /**
     * Busca cidades usando a API de geocoding do OpenWeatherMap
     * Limitado apenas a Portugal (PT) com busca inteligente
     */
    public function searchCities(string $query): array
    {
        // Limpar e normalizar query
        $query = trim($query);
        if (empty($query) || strlen($query) < 2) {
            return [];
        }

        $cacheKey = "cities_search_pt_" . md5(strtolower($query));
        
        return Cache::remember($cacheKey, 7200, function () use ($query) {
            $allResults = [];
            
            // Estratégia 1: Busca direta com ", Portugal"
            try {
                $response1 = Http::timeout(3)->get("{$this->baseUrl}/geo/1.0/direct", [
                    'q' => $query . ', Portugal',
                    'limit' => 10,
                    'appid' => $this->apiKey
                ]);

                if ($response1->successful()) {
                    $data = $response1->json();
                    if (!empty($data)) {
                        foreach ($data as $city) {
                            if (($city['country'] ?? '') === 'PT' 
                                && !empty($city['name'])
                                && isset($city['lat'])
                                && isset($city['lon'])) {
                                
                                $allResults[$city['name']] = [
                                    'name' => $city['name'],
                                    'country' => 'PT',
                                    'state' => $city['state'] ?? null,
                                    'lat' => (float) $city['lat'],
                                    'lon' => (float) $city['lon'],
                                ];
                            }
                        }
                    }
                }
            } catch (\Exception $e) {
                // Continuar com outras estratégias
            }

            // Estratégia 2: Se não encontrou resultados suficientes, tentar busca mais ampla
            if (count($allResults) < 5) {
                try {
                    $response2 = Http::timeout(3)->get("{$this->baseUrl}/geo/1.0/direct", [
                        'q' => $query,
                        'limit' => 15,
                        'appid' => $this->apiKey
                    ]);

                    if ($response2->successful()) {
                        $data = $response2->json();
                        if (!empty($data)) {
                            foreach ($data as $city) {
                                // Filtrar apenas Portugal e evitar duplicados
                                if (($city['country'] ?? '') === 'PT' 
                                    && !empty($city['name'])
                                    && isset($city['lat'])
                                    && isset($city['lon'])
                                    && !isset($allResults[$city['name']])) {
                                    
                                    $allResults[$city['name']] = [
                                        'name' => $city['name'],
                                        'country' => 'PT',
                                        'state' => $city['state'] ?? null,
                                        'lat' => (float) $city['lat'],
                                        'lon' => (float) $city['lon'],
                                    ];
                                }
                            }
                        }
                    }
                } catch (\Exception $e) {
                    // Continuar
                }
            }

            // Ordenar resultados por relevância (cidades que começam com a query primeiro)
            $normalizedQuery = mb_strtolower($this->normalizeString($query));
            $sortedResults = array_values($allResults);
            
            usort($sortedResults, function ($a, $b) use ($normalizedQuery) {
                $aNorm = mb_strtolower($this->normalizeString($a['name']));
                $bNorm = mb_strtolower($this->normalizeString($b['name']));
                
                $aStarts = mb_strpos($aNorm, $normalizedQuery) === 0;
                $bStarts = mb_strpos($bNorm, $normalizedQuery) === 0;
                
                if ($aStarts && !$bStarts) return -1;
                if (!$aStarts && $bStarts) return 1;
                
                // Se ambas começam ou não começam, ordenar alfabeticamente
                return strcmp($aNorm, $bNorm);
            });

            return array_slice($sortedResults, 0, 10); // Retornar até 10 resultados
        });
    }

    /**
     * Normaliza string removendo acentos
     */
    protected function normalizeString(string $str): string
    {
        $str = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $str);
        return strtolower(trim($str));
    }

    /**
     * Obtém previsão do tempo para uma cidade
     */
    public function getForecastForCity(string $city, int $days = 5): array
    {
        // Primeiro, obter coordenadas da cidade
        $cityData = $this->getCityCoordinates($city);
        
        if (empty($cityData)) {
            throw new \Exception("Cidade '{$city}' não encontrada");
        }

        $lat = $cityData['lat'];
        $lon = $cityData['lon'];
        $cityName = $cityData['name'];

        // Obter previsão do tempo
        $forecast = $this->getForecast($lat, $lon, $days, $cityData);
        
        return [
            'city' => $cityName,
            'country' => $cityData['country'] ?? '',
            'coordinates' => [
                'lat' => $lat,
                'lon' => $lon
            ],
            'forecast' => $forecast
        ];
    }

    /**
     * Obtém coordenadas de uma cidade
     * Prioriza cidades de Portugal
     */
    protected function getCityCoordinates(string $city): ?array
    {
        $cacheKey = "city_coords_pt_{$city}";
        
        return Cache::remember($cacheKey, 86400, function () use ($city) {
            try {
                // Primeiro tentar buscar especificamente em Portugal
                $response = Http::get("{$this->baseUrl}/geo/1.0/direct", [
                    'q' => $city . ', PT',
                    'limit' => 5,
                    'appid' => $this->apiKey
                ]);

                if ($response->successful()) {
                    $data = $response->json();
                    
                    // Filtrar apenas cidades de Portugal
                    $portugalCities = array_filter($data, function ($item) {
                        return ($item['country'] ?? '') === 'PT';
                    });
                    
                    if (!empty($portugalCities)) {
                        $cityData = reset($portugalCities);
                        return [
                            'name' => $cityData['name'],
                            'country' => $cityData['country'] ?? 'PT',
                            'state' => $cityData['state'] ?? null,
                            'lat' => $cityData['lat'],
                            'lon' => $cityData['lon'],
                        ];
                    }
                }

                // Se não encontrou em Portugal, tentar busca geral mas filtrar por PT
                $response = Http::get("{$this->baseUrl}/geo/1.0/direct", [
                    'q' => $city,
                    'limit' => 5,
                    'appid' => $this->apiKey
                ]);

                if ($response->successful()) {
                    $data = $response->json();
                    
                    // Procurar primeiro por cidades de Portugal
                    foreach ($data as $item) {
                        if (($item['country'] ?? '') === 'PT') {
                            return [
                                'name' => $item['name'],
                                'country' => $item['country'] ?? 'PT',
                                'state' => $item['state'] ?? null,
                                'lat' => $item['lat'],
                                'lon' => $item['lon'],
                            ];
                        }
                    }
                }

                return null;
            } catch (\Exception $e) {
                Log::error('Erro ao obter coordenadas: ' . $e->getMessage());
                return null;
            }
        });
    }

    /**
     * Obtém previsão do tempo
     */
    protected function getForecast(float $lat, float $lon, int $days, array $cityData = []): array
    {
        $cacheKey = "forecast_{$lat}_{$lon}_{$days}";
        
        return Cache::remember($cacheKey, 1800, function () use ($lat, $lon, $days, $cityData) {
            try {
                $response = Http::get("{$this->baseUrl}/data/2.5/forecast", [
                    'lat' => $lat,
                    'lon' => $lon,
                    'cnt' => min($days * 8, 40), // 8 previsões por dia (3 horas cada)
                    'units' => 'metric',
                    'lang' => 'pt',
                    'appid' => $this->apiKey
                ]);

                if (!$response->successful()) {
                    throw new \Exception('Erro ao obter previsão do tempo');
                }

                $data = $response->json();
                
                return $this->processForecastData($data['list'], $days, $lat, $lon);
            } catch (\Exception $e) {
                Log::error('Erro ao obter previsão: ' . $e->getMessage());
                throw $e;
            }
        });
    }

    /**
     * Calcula horários de nascer e pôr do sol
     */
    protected function getSunTimes(float $lat, float $lon): array
    {
        $date = time();
        $zenith = 90.833; // Zenith padrão para nascer/pôr do sol
        
        // Calcular nascer do sol
        $sunrise = $this->calculateSunTime($lat, $lon, $date, true, $zenith);
        $sunset = $this->calculateSunTime($lat, $lon, $date, false, $zenith);
        
        return [
            'sunrise' => date('H:i', $sunrise),
            'sunset' => date('H:i', $sunset),
        ];
    }

    /**
     * Calcula horário de nascer ou pôr do sol
     */
    protected function calculateSunTime(float $lat, float $lon, int $date, bool $isSunrise, float $zenith): int
    {
        // Converter latitude para radianos
        $latRad = deg2rad($lat);
        
        // Calcular dia do ano
        $dayOfYear = date('z', $date) + 1;
        
        // Calcular declinação solar
        $declination = 23.45 * sin(deg2rad(360 * (284 + $dayOfYear) / 365));
        $declinationRad = deg2rad($declination);
        
        // Calcular hora solar
        $hourAngle = acos(
            (cos(deg2rad($zenith)) - sin($latRad) * sin($declinationRad)) /
            (cos($latRad) * cos($declinationRad))
        );
        
        // Converter para horas
        $time = $isSunrise 
            ? 12 - rad2deg($hourAngle) / 15
            : 12 + rad2deg($hourAngle) / 15;
        
        // Ajustar para longitude (timezone)
        $time += ($lon / 15);
        
        // Converter para timestamp
        $hours = floor($time);
        $minutes = floor(($time - $hours) * 60);
        
        return mktime($hours, $minutes, 0, date('n', $date), date('j', $date), date('Y', $date));
    }

    /**
     * Processa dados da previsão e avalia condições para fotografia
     */
    protected function processForecastData(array $list, int $days, float $lat, float $lon): array
    {
        // Agrupar por dia
        $dailyData = [];
        
        foreach ($list as $item) {
            $date = date('Y-m-d', $item['dt']);
            
            if (!isset($dailyData[$date])) {
                $dailyData[$date] = [];
            }
            
            $dailyData[$date][] = $item;
        }

        // Processar cada dia
        $forecast = [];
        $count = 0;
        
        foreach ($dailyData as $date => $items) {
            if ($count >= $days) break;
            
            $forecast[] = $this->analyzeDayForPhotography($date, $items, $lat, $lon);
            $count++;
        }

        return $forecast;
    }

    /**
     * Analisa condições de um dia para fotografia
     */
    protected function analyzeDayForPhotography(string $date, array $items, float $lat, float $lon): array
    {
        // Calcular médias e extremos
        $clouds = [];
        foreach ($items as $item) {
            $clouds[] = is_array($item['clouds']) ? ($item['clouds']['all'] ?? 0) : $item['clouds'];
        }
        $windData = array_column($items, 'wind');
        $visibilities = array_column($items, 'visibility');
        $temperatures = array_column($items, 'main');
        $weatherData = array_column($items, 'weather');
        
        $avgClouds = !empty($clouds) ? (array_sum($clouds) / count($clouds)) : 0;
        $avgWindSpeed = !empty($windData) ? (array_sum(array_column($windData, 'speed')) / count($windData)) : 0;
        
        // Calcular direção média do vento
        $windDirections = array_filter(array_column($windData, 'deg'), function($val) {
            return $val !== null;
        });
        $avgWindDirection = !empty($windDirections) 
            ? $this->calculateAverageWindDirection($windDirections) 
            : null;
        
        $avgVisibility = !empty($visibilities) ? (array_sum($visibilities) / count($visibilities)) / 1000 : 10; // Converter para km
        $avgTemp = array_sum(array_column($temperatures, 'temp')) / count($temperatures);
        
        // Analisar informações detalhadas de nuvens
        $cloudDetails = $this->analyzeCloudDetails($items, $weatherData);
        
        // Obter dados do primeiro item para informações gerais
        $firstItem = $items[0];
        $weather = $firstItem['weather'][0];
        
        // Calcular informações detalhadas do sol
        try {
            $dateTimestamp = strtotime($date);
            if ($dateTimestamp === false) {
                $dateTimestamp = time();
            }
            $sunInfo = $this->calculateDetailedSunInfo($lat, $lon, $dateTimestamp);
        } catch (\Exception $e) {
            Log::error('Erro ao calcular informações do sol: ' . $e->getMessage());
            $sunInfo = [];
        }
        
        // Calcular informações atmosféricas detalhadas
        try {
            $atmosphericInfo = $this->calculateAtmosphericConditions($items, $weatherData);
        } catch (\Exception $e) {
            Log::error('Erro ao calcular condições atmosféricas: ' . $e->getMessage());
            $atmosphericInfo = [];
        }
        
        // Calcular condições de água/espelhagem
        try {
            $waterConditions = $this->calculateWaterConditions($avgWindSpeed, $avgWindDirection, $atmosphericInfo);
        } catch (\Exception $e) {
            Log::error('Erro ao calcular condições de água: ' . $e->getMessage());
            $waterConditions = [];
        }
        
        // Calcular fotometria e cores
        try {
            $photometry = $this->calculatePhotometry($avgClouds, $cloudDetails, $atmosphericInfo, $sunInfo);
        } catch (\Exception $e) {
            Log::error('Erro ao calcular fotometria: ' . $e->getMessage());
            $photometry = [];
        }
        
        // Calcular sugestões de equipamento
        try {
            $equipmentSuggestions = $this->calculateEquipmentSuggestions(
                $avgClouds,
                $cloudDetails,
                $avgWindSpeed,
                $avgVisibility,
                $atmosphericInfo,
                $waterConditions,
                $photometry,
                $sunInfo
            );
        } catch (\Exception $e) {
            Log::error('Erro ao calcular sugestões de equipamento: ' . $e->getMessage());
            $equipmentSuggestions = [];
        }
        
        // Avaliar condições para fotografia
        $photographyStatus = $this->evaluatePhotographyConditions(
            $avgClouds,
            $avgWindSpeed,
            $avgVisibility,
            $weather['main'],
            $cloudDetails
        );

        $photographyNotes = $this->generatePhotographyNotes(
            $photographyStatus,
            $avgClouds,
            $avgWindSpeed,
            $avgVisibility,
            $weather['main'],
            $cloudDetails,
            $avgWindDirection,
            $atmosphericInfo,
            $waterConditions,
            $photometry,
            $sunInfo
        );

        return [
            'date' => $date,
            'description' => ucfirst($weather['description']),
            'temperature' => round($avgTemp, 1),
            'clouds' => round($avgClouds),
            'cloud_details' => $cloudDetails ?: [],
            'wind_speed' => round($avgWindSpeed * 3.6, 1), // Converter m/s para km/h
            'wind_direction' => $avgWindDirection ? [
                'degrees' => round($avgWindDirection),
                'cardinal' => $this->degreesToCardinal($avgWindDirection),
                'arrow' => $this->getWindArrow($avgWindDirection)
            ] : null,
            'visibility' => round($avgVisibility, 1),
            'humidity' => round($firstItem['main']['humidity']),
            'pressure' => isset($firstItem['main']['pressure']) ? round($firstItem['main']['pressure']) : null,
            'sun_info' => $sunInfo ?: [],
            'atmospheric' => $atmosphericInfo ?: [],
            'water_conditions' => $waterConditions ?: [],
            'photometry' => $photometry ?: [],
            'equipment_suggestions' => $equipmentSuggestions ?: [],
            'photography_status' => $photographyStatus,
            'photography_notes' => $photographyNotes,
        ];
    }

    /**
     * Analisa detalhes das nuvens baseado em condições meteorológicas
     */
    protected function analyzeCloudDetails(array $items, array $weatherData): array
    {
        $cloudTypes = [];
        $cloudHeights = [];
        
        foreach ($items as $index => $item) {
            if (isset($weatherData[$index][0])) {
                $weather = $weatherData[$index][0];
                $main = strtolower($weather['main']);
                $description = strtolower($weather['description']);
                $clouds = $item['clouds']['all'] ?? 0;
                
                // Inferir tipo e altura das nuvens baseado em condições
                $cloudCoverage = is_array($item['clouds']) ? ($item['clouds']['all'] ?? 0) : $item['clouds'];
                
                if (strpos($description, 'clear') !== false || strpos($description, 'sunny') !== false) {
                    $cloudTypes[] = 'limpo';
                    $cloudHeights[] = 'sem nuvens';
                } elseif (strpos($description, 'few') !== false || strpos($description, 'scattered') !== false) {
                    // Nuvens esparsas geralmente são altas (cirrus) ou médias
                    if ($cloudCoverage < 30) {
                        $cloudTypes[] = 'cirrus';
                        $cloudHeights[] = 'alta';
                    } else {
                        $cloudTypes[] = 'cumulus';
                        $cloudHeights[] = 'média';
                    }
                } elseif (strpos($description, 'broken') !== false || strpos($description, 'overcast') !== false) {
                    // Nuvens densas podem ser médias ou baixas
                    if (strpos($description, 'stratus') !== false || strpos($description, 'fog') !== false) {
                        $cloudTypes[] = 'stratus';
                        $cloudHeights[] = 'baixa';
                    } else {
                        $cloudTypes[] = 'cumulus/stratus';
                        $cloudHeights[] = 'média-baixa';
                    }
                } elseif (strpos($description, 'cumulus') !== false) {
                    $cloudTypes[] = 'cumulus';
                    $cloudHeights[] = 'média';
                } elseif (strpos($description, 'stratus') !== false) {
                    $cloudTypes[] = 'stratus';
                    $cloudHeights[] = 'baixa';
                } elseif (strpos($description, 'cirrus') !== false) {
                    $cloudTypes[] = 'cirrus';
                    $cloudHeights[] = 'alta';
                } else {
                    // Default baseado em cobertura
                    if ($cloudCoverage < 25) {
                        $cloudTypes[] = 'cirrus';
                        $cloudHeights[] = 'alta';
                    } elseif ($cloudCoverage < 50) {
                        $cloudTypes[] = 'cumulus';
                        $cloudHeights[] = 'média';
                    } else {
                        $cloudTypes[] = 'stratus';
                        $cloudHeights[] = 'baixa';
                    }
                }
            }
        }
        
        // Determinar tipo e altura mais comuns
        $typeCounts = array_count_values($cloudTypes);
        $heightCounts = array_count_values($cloudHeights);
        
        $mostCommonType = !empty($typeCounts) ? array_search(max($typeCounts), $typeCounts) : 'variado';
        $mostCommonHeight = !empty($heightCounts) ? array_search(max($heightCounts), $heightCounts) : 'variado';
        
        // Calcular cobertura média e variação
        $coverages = [];
        foreach ($items as $item) {
            $coverages[] = is_array($item['clouds']) ? ($item['clouds']['all'] ?? 0) : $item['clouds'];
        }
        $avgCoverage = round(array_sum($coverages) / count($coverages));
        $minCoverage = min($coverages);
        $maxCoverage = max($coverages);
        $coverageVariation = $maxCoverage - $minCoverage;
        
        // Analisar distribuição das nuvens (variação indica movimento/mudança)
        $distribution = 'estável';
        $distributionDescription = 'Cobertura de nuvens estável ao longo do dia';
        if ($coverageVariation > 30) {
            $distribution = 'variável';
            $distributionDescription = 'Cobertura de nuvens variável - movimento significativo previsto';
        } elseif ($coverageVariation > 15) {
            $distribution = 'moderada';
            $distributionDescription = 'Alguma variação na cobertura de nuvens ao longo do dia';
        }
        
        // Previsão de movimento das nuvens
        $movement = 'lento';
        $movementDescription = 'Nuvens movem-se lentamente';
        if ($coverageVariation > 25) {
            $movement = 'rápido';
            $movementDescription = 'Nuvens movem-se rapidamente - condições podem mudar durante golden hour';
        } elseif ($coverageVariation > 10) {
            $movement = 'moderado';
            $movementDescription = 'Movimento moderado das nuvens';
        }
        
        // Analisar se nuvens estão mais concentradas no horizonte (baseado em padrões)
        // Se cobertura aumenta ao longo do dia, pode indicar nuvens no horizonte
        $horizonConcentration = 'espalhadas';
        if (count($coverages) >= 3) {
            $firstHalf = array_slice($coverages, 0, ceil(count($coverages) / 2));
            $secondHalf = array_slice($coverages, ceil(count($coverages) / 2));
            $firstAvg = array_sum($firstHalf) / count($firstHalf);
            $secondAvg = array_sum($secondHalf) / count($secondHalf);
            
            if ($secondAvg > $firstAvg + 10) {
                $horizonConcentration = 'no horizonte';
            } elseif ($firstAvg > $secondAvg + 10) {
                $horizonConcentration = 'no início do dia';
            }
        }
        
        return [
            'type' => $mostCommonType,
            'height' => $mostCommonHeight,
            'coverage' => $avgCoverage,
            'coverage_range' => [
                'min' => $minCoverage,
                'max' => $maxCoverage,
                'variation' => $coverageVariation
            ],
            'distribution' => [
                'pattern' => $distribution,
                'description' => $distributionDescription,
                'horizon_concentration' => $horizonConcentration
            ],
            'movement' => [
                'speed' => $movement,
                'description' => $movementDescription
            ],
            'description' => $this->getCloudDescription($mostCommonType, $mostCommonHeight)
        ];
    }

    /**
     * Gera descrição das nuvens
     */
    protected function getCloudDescription(string $type, string $height): string
    {
        $descriptions = [
            'limpo' => 'Céu limpo',
            'cirrus' => 'Nuvens altas (Cirrus) - boas para fotos dramáticas',
            'cumulus' => 'Nuvens médias (Cumulus) - ideais para composição',
            'stratus' => 'Nuvens baixas (Stratus) - podem bloquear luz',
            'cumulus/stratus' => 'Nuvens médias-baixas - atenção à luz',
        ];
        
        $base = $descriptions[$type] ?? 'Nuvens variadas';
        
        if ($height !== 'sem nuvens' && $height !== 'variado') {
            return $base . " - Altura: {$height}";
        }
        
        return $base;
    }

    /**
     * Calcula direção média do vento (considerando circularidade)
     */
    protected function calculateAverageWindDirection(array $directions): float
    {
        if (empty($directions)) {
            return 0;
        }
        
        // Converter para coordenadas circulares
        $x = 0;
        $y = 0;
        
        foreach ($directions as $deg) {
            $rad = deg2rad($deg);
            $x += cos($rad);
            $y += sin($rad);
        }
        
        $x /= count($directions);
        $y /= count($directions);
        
        $avgRad = atan2($y, $x);
        $avgDeg = rad2deg($avgRad);
        
        // Normalizar para 0-360
        return $avgDeg < 0 ? $avgDeg + 360 : $avgDeg;
    }

    /**
     * Converte graus em direção cardeal
     */
    protected function degreesToCardinal(float $degrees): string
    {
        $directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        $index = round($degrees / 22.5) % 16;
        return $directions[$index];
    }

    /**
     * Retorna emoji/símbolo da direção do vento
     */
    protected function getWindArrow(float $degrees): string
    {
        // Usar setas Unicode baseadas na direção
        $cardinal = $this->degreesToCardinal($degrees);
        
        $arrows = [
            'N' => '⬆️', 'NNE' => '⬆️', 'NE' => '↗️', 'ENE' => '➡️',
            'E' => '➡️', 'ESE' => '➡️', 'SE' => '↘️', 'SSE' => '⬇️',
            'S' => '⬇️', 'SSW' => '⬇️', 'SW' => '↙️', 'WSW' => '⬅️',
            'W' => '⬅️', 'WNW' => '⬅️', 'NW' => '↖️', 'NNW' => '⬆️'
        ];
        
        return $arrows[$cardinal] ?? '➡️';
    }

    /**
     * Calcula informações detalhadas do sol (golden hour, blue hour, azimute, elevação)
     */
    protected function calculateDetailedSunInfo(float $lat, float $lon, int $date): array
    {
        try {
            $zenith = 90.833;
            $sunrise = $this->calculateSunTime($lat, $lon, $date, true, $zenith);
            $sunset = $this->calculateSunTime($lat, $lon, $date, false, $zenith);
            
            if (!$sunrise || !$sunset) {
                throw new \Exception('Erro ao calcular horários do sol');
            }
            
            // Manhã: Blue Hour vem ANTES da Golden Hour
            // Blue Hour Manhã: 1h30 antes do nascer até 1h antes do nascer
            $blueHourMorningStart = $sunrise - 5400; // 1h30 antes
            $blueHourMorningEnd = $sunrise - 3600; // 1h antes
            
            // Golden Hour Manhã: 1h antes do nascer até o nascer do sol
            $goldenHourMorningStart = $sunrise - 3600; // 1h antes
            $goldenHourMorningEnd = $sunrise; // No nascer do sol
            
            // Tarde: Golden Hour vem ANTES da Blue Hour
            // Golden Hour Tarde: 30min antes do pôr até 30min depois do pôr
            $goldenHourEveningStart = $sunset - 1800; // 30min antes
            $goldenHourEveningEnd = $sunset + 1800; // 30min depois
            
            // Blue Hour Tarde: 30min depois do pôr até 1h depois do pôr
            $blueHourEveningStart = $sunset + 1800; // 30min depois
            $blueHourEveningEnd = $sunset + 3600; // 1h depois
            
            // Calcular azimute e elevação do sol no nascer e pôr
            $sunriseAzimuth = $this->calculateSunAzimuth($lat, $lon, $sunrise);
            $sunsetAzimuth = $this->calculateSunAzimuth($lat, $lon, $sunset);
            $sunriseElevation = $this->calculateSunElevation($lat, $lon, $sunrise);
            $sunsetElevation = $this->calculateSunElevation($lat, $lon, $sunset);
            
            return [
                'sunrise' => date('H:i', $sunrise),
                'sunset' => date('H:i', $sunset),
                'golden_hour' => [
                    'morning' => [
                        'start' => date('H:i', $goldenHourMorningStart),
                        'end' => date('H:i', $goldenHourMorningEnd),
                        'duration' => '1h'
                    ],
                    'evening' => [
                        'start' => date('H:i', $goldenHourEveningStart),
                        'end' => date('H:i', $goldenHourEveningEnd),
                        'duration' => '1h'
                    ]
                ],
                'blue_hour' => [
                    'morning' => [
                        'start' => date('H:i', $blueHourMorningStart),
                        'end' => date('H:i', $blueHourMorningEnd),
                        'duration' => '30min'
                    ],
                    'evening' => [
                        'start' => date('H:i', $blueHourEveningStart),
                        'end' => date('H:i', $blueHourEveningEnd),
                        'duration' => '30min'
                    ]
                ],
                'sunrise_azimuth' => round($sunriseAzimuth, 1),
                'sunset_azimuth' => round($sunsetAzimuth, 1),
                'sunrise_elevation' => round($sunriseElevation, 1),
                'sunset_elevation' => round($sunsetElevation, 1),
                'sunrise_direction' => $this->azimuthToDirection($sunriseAzimuth),
                'sunset_direction' => $this->azimuthToDirection($sunsetAzimuth)
            ];
        } catch (\Exception $e) {
            Log::error('Erro ao calcular informações detalhadas do sol: ' . $e->getMessage());
            // Retornar dados básicos mesmo em caso de erro
            return [
                'sunrise' => 'N/A',
                'sunset' => 'N/A',
                'golden_hour' => null,
                'blue_hour' => null,
                'sunrise_azimuth' => 0,
                'sunset_azimuth' => 0,
                'sunrise_elevation' => 0,
                'sunset_elevation' => 0,
                'sunrise_direction' => 'N/A',
                'sunset_direction' => 'N/A'
            ];
        }
    }

    /**
     * Calcula azimute do sol (direção)
     */
    protected function calculateSunAzimuth(float $lat, float $lon, int $timestamp): float
    {
        try {
            $latRad = deg2rad($lat);
            $dayOfYear = date('z', $timestamp) + 1;
            $declination = 23.45 * sin(deg2rad(360 * (284 + $dayOfYear) / 365));
            $declinationRad = deg2rad($declination);
            
            $hour = (int)date('H', $timestamp) + ((int)date('i', $timestamp) / 60.0);
            $solarTime = $hour + ($lon / 15.0) - 12.0;
            $hourAngle = 15.0 * $solarTime;
            $hourAngleRad = deg2rad($hourAngle);
            
            // Fórmula corrigida para azimute
            $azimuth = atan2(
                sin($hourAngleRad),
                cos($hourAngleRad) * sin($latRad) - tan($declinationRad) * cos($latRad)
            );
            
            $azimuthDeg = rad2deg($azimuth);
            $azimuthDeg = $azimuthDeg < 0 ? $azimuthDeg + 360 : $azimuthDeg;
            
            return $azimuthDeg;
        } catch (\Exception $e) {
            Log::error('Erro ao calcular azimute: ' . $e->getMessage());
            return 90.0; // Default para Leste
        }
    }

    /**
     * Calcula elevação do sol (ângulo acima do horizonte)
     */
    protected function calculateSunElevation(float $lat, float $lon, int $timestamp): float
    {
        try {
            $latRad = deg2rad($lat);
            $dayOfYear = date('z', $timestamp) + 1;
            $declination = 23.45 * sin(deg2rad(360 * (284 + $dayOfYear) / 365));
            $declinationRad = deg2rad($declination);
            
            $hour = (int)date('H', $timestamp) + ((int)date('i', $timestamp) / 60.0);
            $solarTime = $hour + ($lon / 15.0) - 12.0;
            $hourAngle = 15.0 * $solarTime;
            $hourAngleRad = deg2rad($hourAngle);
            
            $sinElevation = sin($latRad) * sin($declinationRad) +
                           cos($latRad) * cos($declinationRad) * cos($hourAngleRad);
            
            // Garantir que está no range válido para asin
            $sinElevation = max(-1.0, min(1.0, $sinElevation));
            
            $elevation = asin($sinElevation);
            
            return rad2deg($elevation);
        } catch (\Exception $e) {
            Log::error('Erro ao calcular elevação: ' . $e->getMessage());
            return 0.0; // Default para horizonte
        }
    }

    /**
     * Converte azimute em direção cardeal
     */
    protected function azimuthToDirection(float $azimuth): string
    {
        $directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        $index = round($azimuth / 22.5) % 16;
        return $directions[$index];
    }

    /**
     * Calcula condições atmosféricas detalhadas
     */
    protected function calculateAtmosphericConditions(array $items, array $weatherData): array
    {
        $humidities = array_column(array_column($items, 'main'), 'humidity');
        $visibilities = array_column($items, 'visibility');
        $pressures = array_column(array_column($items, 'main'), 'pressure');
        $precipitations = [];
        
        foreach ($items as $item) {
            if (isset($item['rain']['3h'])) {
                $precipitations[] = $item['rain']['3h'];
            } elseif (isset($item['rain']['1h'])) {
                $precipitations[] = $item['rain']['1h'];
            }
        }
        
        $avgHumidity = !empty($humidities) ? array_sum($humidities) / count($humidities) : 0;
        $avgVisibility = !empty($visibilities) ? (array_sum($visibilities) / count($visibilities)) / 1000 : 10;
        $avgPressure = !empty($pressures) ? array_sum($pressures) / count($pressures) : 1013;
        $totalPrecipitation = array_sum($precipitations);
        
        // Detectar neblina/nevoeiro
        $fogMist = false;
        $fogIntensity = 'nenhum';
        foreach ($weatherData as $weather) {
            if (!empty($weather[0])) {
                $main = strtolower($weather[0]['main'] ?? '');
                $desc = strtolower($weather[0]['description'] ?? '');
                if (strpos($main, 'fog') !== false || strpos($desc, 'fog') !== false || 
                    strpos($desc, 'mist') !== false || strpos($desc, 'neblina') !== false ||
                    strpos($desc, 'nevoeiro') !== false) {
                    $fogMist = true;
                    if (strpos($desc, 'dense') !== false || strpos($desc, 'denso') !== false) {
                        $fogIntensity = 'denso';
                    } elseif (strpos($desc, 'light') !== false || strpos($desc, 'leve') !== false) {
                        $fogIntensity = 'leve';
                    } else {
                        $fogIntensity = 'moderado';
                    }
                    break;
                }
            }
        }
        
        // Avaliar risco de neblina baseado em humidade e visibilidade
        if (!$fogMist && $avgHumidity > 85 && $avgVisibility < 5) {
            $fogMist = true;
            $fogIntensity = 'possível';
        }
        
        // Detectar tipo de precipitação
        $precipitationType = 'nenhuma';
        $precipitationIntensity = 'nenhuma';
        if ($totalPrecipitation > 0) {
            if ($totalPrecipitation < 0.5) {
                $precipitationType = 'garoa leve';
                $precipitationIntensity = 'muito leve';
            } elseif ($totalPrecipitation < 2.0) {
                $precipitationType = 'chuvisco';
                $precipitationIntensity = 'leve';
            } elseif ($totalPrecipitation < 5.0) {
                $precipitationType = 'chuva';
                $precipitationIntensity = 'moderada';
            } else {
                $precipitationType = 'chuva forte';
                $precipitationIntensity = 'forte';
            }
        }
        
        return [
            'humidity' => round($avgHumidity),
            'humidity_risk' => $avgHumidity > 85 ? 'alto' : ($avgHumidity > 70 ? 'médio' : 'baixo'),
            'fog_mist' => $fogMist,
            'fog_intensity' => $fogIntensity,
            'visibility' => round($avgVisibility, 1),
            'pressure' => round($avgPressure),
            'precipitation' => [
                'total' => round($totalPrecipitation, 1),
                'type' => $precipitationType,
                'intensity' => $precipitationIntensity
            ]
        ];
    }

    /**
     * Calcula condições de água e espelhagem
     */
    protected function calculateWaterConditions(float $windSpeed, ?float $windDirection, array $atmosphericInfo): array
    {
        // Avaliar condições de espelhagem baseado em vento
        $mirrorQuality = 'excelente';
        $mirrorDescription = 'Superfície de água calma - perfeita para espelhagem';
        
        if ($windSpeed < 1) {
            $mirrorQuality = 'excelente';
            $mirrorDescription = 'Vento praticamente nulo - condições ideais para espelhagem perfeita';
        } elseif ($windSpeed < 3) {
            $mirrorQuality = 'muito boa';
            $mirrorDescription = 'Vento muito calmo - excelente para espelhagem';
        } elseif ($windSpeed < 5) {
            $mirrorQuality = 'boa';
            $mirrorDescription = 'Vento leve - boa espelhagem com pequenas ondulações';
        } elseif ($windSpeed < 8) {
            $mirrorQuality = 'razoável';
            $mirrorDescription = 'Vento moderado - espelhagem com ondulações visíveis';
        } elseif ($windSpeed < 12) {
            $mirrorQuality = 'má';
            $mirrorDescription = 'Vento forte - espelhagem comprometida, muitas ondulações';
        } else {
            $mirrorQuality = 'muito má';
            $mirrorDescription = 'Vento muito forte - sem condições para espelhagem';
        }
        
        // Considerar humidade para neblina sobre água
        $waterFogRisk = 'baixo';
        if ($atmosphericInfo['humidity'] > 90 && $windSpeed < 3) {
            $waterFogRisk = 'alto';
        } elseif ($atmosphericInfo['humidity'] > 80) {
            $waterFogRisk = 'médio';
        }
        
        return [
            'mirror_quality' => $mirrorQuality,
            'mirror_description' => $mirrorDescription,
            'wind_for_water' => [
                'speed' => round($windSpeed * 3.6, 1),
                'suitable' => $windSpeed < 5
            ],
            'water_fog_risk' => $waterFogRisk,
            'recommendation' => $windSpeed < 3 
                ? 'Condições ideais para fotos de espelhagem' 
                : ($windSpeed < 5 ? 'Boa para espelhagem com cuidado' : 'Não recomendado para espelhagem')
        ];
    }

    /**
     * Calcula fotometria e cores (dispersão da luz, brilho, contraste)
     */
    protected function calculatePhotometry(float $clouds, array $cloudDetails, array $atmosphericInfo, array $sunInfo): array
    {
        // Índice de dispersão da luz (baseado em nuvens e partículas)
        $lightScattering = 0;
        $scatteringDescription = '';
        
        // Nuvens altas (Cirrus) aumentam dispersão e cores dramáticas
        if (($cloudDetails['type'] ?? '') === 'cirrus' || ($cloudDetails['height'] ?? '') === 'alta') {
            $lightScattering = 85;
            $scatteringDescription = 'Alta dispersão - cores intensas e dramáticas no nascer/pôr do sol';
        } elseif ($clouds >= 20 && $clouds <= 40) {
            $lightScattering = 75;
            $scatteringDescription = 'Boa dispersão - cores vibrantes esperadas';
        } elseif ($clouds < 20) {
            $lightScattering = 50;
            $scatteringDescription = 'Dispersão moderada - cores mais suaves';
        } else {
            $lightScattering = 30;
            $scatteringDescription = 'Baixa dispersão - cores podem ser apagadas';
        }
        
        // Ajustar por humidade (mais humidade = mais partículas = mais dispersão)
        if ($atmosphericInfo['humidity'] > 80) {
            $lightScattering += 10;
            $scatteringDescription .= ' (aumentado por humidade alta)';
        }
        
        $lightScattering = min(100, max(0, $lightScattering));
        
        // Intensidade de brilho
        $brightness = 'média';
        $brightnessValue = 50;
        if ($clouds < 20) {
            $brightness = 'alta';
            $brightnessValue = 80;
        } elseif ($clouds < 40) {
            $brightness = 'média-alta';
            $brightnessValue = 65;
        } elseif ($clouds < 70) {
            $brightness = 'média';
            $brightnessValue = 50;
        } else {
            $brightness = 'baixa';
            $brightnessValue = 30;
        }
        
        // Contraste do céu
        $contrast = 'médio';
        if (($cloudDetails['type'] ?? '') === 'cirrus' && $clouds >= 20 && $clouds <= 50) {
            $contrast = 'alto';
        } elseif ($clouds < 20 || $clouds > 70) {
            $contrast = 'baixo';
        }
        
        return [
            'light_scattering' => [
                'index' => round($lightScattering),
                'description' => $scatteringDescription,
                'quality' => $lightScattering >= 70 ? 'excelente' : ($lightScattering >= 50 ? 'boa' : 'moderada')
            ],
            'brightness' => [
                'level' => $brightness,
                'value' => $brightnessValue,
                'description' => $brightness === 'alta' 
                    ? 'Céu muito brilhante - usar filtros ND se necessário'
                    : ($brightness === 'baixa' ? 'Céu escuro - pode precisar de exposição mais longa' : 'Brilho adequado')
            ],
            'contrast' => [
                'level' => $contrast,
                'description' => $contrast === 'alto' 
                    ? 'Alto contraste - cores ricas e dramáticas'
                    : ($contrast === 'baixo' ? 'Baixo contraste - cores mais suaves' : 'Contraste moderado')
            ],
            'color_intensity' => $lightScattering >= 70 ? 'muito alta' : ($lightScattering >= 50 ? 'alta' : 'moderada')
        ];
    }

    /**
     * Avalia condições para fotografia
     */
    protected function evaluatePhotographyConditions(
        float $clouds,
        float $windSpeed,
        float $visibility,
        string $weatherMain,
        array $cloudDetails = []
    ): string {
        $score = 0;
        
        // Nuvens: 20-40% é ideal para fotos dramáticas, 0-20% para céu limpo
        // Considerar também tipo e altura das nuvens
        if (!empty($cloudDetails)) {
            $cloudType = $cloudDetails['type'] ?? '';
            $cloudHeight = $cloudDetails['height'] ?? '';
            
            // Nuvens altas (cirrus) são melhores para fotos dramáticas
            if ($cloudHeight === 'alta' && $clouds >= 20 && $clouds <= 50) {
                $score += 3;
            } elseif ($cloudType === 'cirrus' && $clouds >= 15 && $clouds <= 40) {
                $score += 3; // Cirrus são ideais
            } elseif ($clouds >= 20 && $clouds <= 40) {
                $score += 2; // Perfeito para fotos dramáticas
            } elseif ($clouds < 20) {
                $score += 2; // Céu limpo, bom
            } elseif ($cloudHeight === 'baixa' && $clouds > 60) {
                $score -= 2; // Nuvens baixas densas são ruins
            } elseif ($clouds > 40 && $clouds < 70) {
                $score += 1; // Muitas nuvens, mas ainda aceitável
            } else {
                $score -= 1; // Muitas nuvens
            }
        } else {
            // Fallback para análise simples
            if ($clouds >= 20 && $clouds <= 40) {
                $score += 3; // Perfeito para fotos dramáticas
            } elseif ($clouds < 20) {
                $score += 2; // Céu limpo, bom
            } elseif ($clouds > 40 && $clouds < 70) {
                $score += 1; // Muitas nuvens, mas ainda aceitável
            } else {
                $score -= 1; // Muitas nuvens
            }
        }

        // Vento: baixo é melhor para espelhagem e estabilidade
        if ($windSpeed < 3) { // < 3 m/s
            $score += 2;
        } elseif ($windSpeed < 5) { // 3-5 m/s
            $score += 1;
        } elseif ($windSpeed > 10) { // > 10 m/s
            $score -= 2; // Muito vento
        }

        // Visibilidade: quanto maior, melhor
        if ($visibility >= 10) {
            $score += 2;
        } elseif ($visibility >= 5) {
            $score += 1;
        } else {
            $score -= 1;
        }

        // Condições meteorológicas
        if (in_array($weatherMain, ['Clear', 'Sunny'])) {
            $score += 1;
        } elseif (in_array($weatherMain, ['Rain', 'Drizzle', 'Thunderstorm'])) {
            $score -= 2;
        } elseif (in_array($weatherMain, ['Fog', 'Mist'])) {
            $score -= 1;
        }

        // Determinar status
        if ($score >= 6) {
            return 'excelente';
        } elseif ($score >= 4) {
            return 'bom';
        } elseif ($score >= 1) {
            return 'razoavel';
        } else {
            return 'mau';
        }
    }

    /**
     * Gera notas sobre condições para fotografia
     */
    protected function generatePhotographyNotes(
        string $status,
        float $clouds,
        float $windSpeed,
        float $visibility,
        string $weatherMain,
        array $cloudDetails = [],
        ?float $windDirection = null,
        array $atmosphericInfo = [],
        array $waterConditions = [],
        array $photometry = [],
        array $sunInfo = []
    ): string {
        $notes = [];

        // Notas detalhadas sobre nuvens
        if (!empty($cloudDetails)) {
            $cloudType = $cloudDetails['type'] ?? '';
            $cloudHeight = $cloudDetails['height'] ?? '';
            $cloudDesc = $cloudDetails['description'] ?? '';
            
            if ($cloudHeight === 'alta' && $clouds >= 20 && $clouds <= 50) {
                $notes[] = "Nuvens altas (Cirrus) - excelentes para fotos dramáticas de pôr/nascer do sol";
            } elseif ($cloudType === 'cirrus') {
                $notes[] = "Nuvens Cirrus (altas) - ideais para composições dramáticas";
            } elseif ($cloudHeight === 'média' && $clouds >= 20 && $clouds <= 40) {
                $notes[] = "Nuvens médias (Cumulus) - boa cobertura para fotos interessantes";
            } elseif ($cloudHeight === 'baixa' && $clouds > 60) {
                $notes[] = "Nuvens baixas densas - podem bloquear a luz do sol";
            } elseif ($clouds >= 20 && $clouds <= 40) {
                $notes[] = "Cobertura de nuvens ideal para fotos dramáticas de pôr/nascer do sol";
            } elseif ($clouds < 20) {
                $notes[] = "Céu limpo - bom para fotos de espelhagem";
            } elseif ($clouds > 70) {
                $notes[] = "Muitas nuvens podem bloquear a luz do sol";
            }
            
            if ($cloudDesc && $cloudDesc !== 'Céu limpo') {
                $notes[] = $cloudDesc;
            }
        } else {
            // Fallback
            if ($clouds >= 20 && $clouds <= 40) {
                $notes[] = "Cobertura de nuvens ideal para fotos dramáticas de pôr/nascer do sol";
            } elseif ($clouds < 20) {
                $notes[] = "Céu limpo - bom para fotos de espelhagem";
            } elseif ($clouds > 70) {
                $notes[] = "Muitas nuvens podem bloquear a luz do sol";
            }
        }

        // Notas detalhadas sobre vento
        if ($windSpeed < 3) {
            $windNote = "Vento calmo - excelente para espelhagem em água";
            if ($windDirection !== null) {
                $cardinal = $this->degreesToCardinal($windDirection);
                $windNote .= " (direção: {$cardinal})";
            }
            $notes[] = $windNote;
        } elseif ($windSpeed < 5) {
            $windNote = "Vento leve - bom para fotografia";
            if ($windDirection !== null) {
                $cardinal = $this->degreesToCardinal($windDirection);
                $windNote .= " (direção: {$cardinal})";
            }
            $notes[] = $windNote;
        } elseif ($windSpeed > 10) {
            $windNote = "Vento forte pode afetar estabilidade e espelhagem";
            if ($windDirection !== null) {
                $cardinal = $this->degreesToCardinal($windDirection);
                $windNote .= " (direção: {$cardinal})";
            }
            $notes[] = $windNote;
        } elseif ($windDirection !== null) {
            $cardinal = $this->degreesToCardinal($windDirection);
            $notes[] = "Vento moderado - direção: {$cardinal}";
        }

        // Notas sobre visibilidade
        if ($visibility < 5) {
            $notes[] = "Visibilidade reduzida pode afetar qualidade das fotos";
        }

        // Notas sobre condições meteorológicas
        if (in_array($weatherMain, ['Rain', 'Drizzle', 'Thunderstorm'])) {
            $notes[] = "Chuva prevista - não ideal para fotografia";
        } elseif ($weatherMain === 'Fog') {
            $notes[] = "Névoa pode criar efeitos interessantes, mas reduz visibilidade";
        }

        // Notas sobre condições atmosféricas
        if (!empty($atmosphericInfo)) {
            if ($atmosphericInfo['fog_mist'] ?? false) {
                $fogIntensity = $atmosphericInfo['fog_intensity'] ?? 'moderado';
                $notes[] = "Neblina/Nevoeiro {$fogIntensity} previsto - pode afetar cores do sol";
            }
            if (($atmosphericInfo['humidity'] ?? 0) > 85) {
                $notes[] = "Humidade muito alta ({$atmosphericInfo['humidity']}%) - risco de neblina";
            }
            if (($atmosphericInfo['precipitation']['total'] ?? 0) > 0) {
                $precipType = $atmosphericInfo['precipitation']['type'] ?? 'precipitação';
                $notes[] = "{$precipType} prevista - verificar antes de sair";
            }
        }

        // Notas sobre condições de água/espelhagem
        if (!empty($waterConditions)) {
            $mirrorQuality = $waterConditions['mirror_quality'] ?? '';
            if (in_array($mirrorQuality, ['excelente', 'muito boa'])) {
                $notes[] = $waterConditions['mirror_description'] ?? 'Condições ideais para espelhagem';
            } elseif ($mirrorQuality === 'má' || $mirrorQuality === 'muito má') {
                $notes[] = $waterConditions['mirror_description'] ?? 'Condições não adequadas para espelhagem';
            }
        }

        // Notas sobre fotometria e cores
        if (!empty($photometry)) {
            $scattering = $photometry['light_scattering'] ?? [];
            if (($scattering['index'] ?? 0) >= 70) {
                $notes[] = "Alta dispersão de luz - cores muito intensas esperadas no nascer/pôr do sol";
            }
            $colorIntensity = $photometry['color_intensity'] ?? '';
            if ($colorIntensity === 'muito alta') {
                $notes[] = "Cores muito intensas previstas - ideal para fotos dramáticas";
            }
        }

        // Notas sobre horários do sol
        if (!empty($sunInfo)) {
            $notes[] = "Golden Hour: Manhã {$sunInfo['golden_hour']['morning']['start']}-{$sunInfo['golden_hour']['morning']['end']}, Tarde {$sunInfo['golden_hour']['evening']['start']}-{$sunInfo['golden_hour']['evening']['end']}";
            $notes[] = "Sol nasce às {$sunInfo['sunrise']} na direção {$sunInfo['sunrise_direction']} ({$sunInfo['sunrise_azimuth']}°), põe-se às {$sunInfo['sunset']} na direção {$sunInfo['sunset_direction']} ({$sunInfo['sunset_azimuth']}°)";
        }

        return implode('. ', $notes) ?: 'Condições normais para fotografia';
    }

    /**
     * Calcula sugestões de equipamento baseadas nas condições
     */
    protected function calculateEquipmentSuggestions(
        float $clouds,
        array $cloudDetails,
        float $windSpeed,
        float $visibility,
        array $atmosphericInfo,
        array $waterConditions,
        array $photometry,
        array $sunInfo
    ): array {
        $suggestions = [
            'lens' => [],
            'tripod' => [],
            'filters' => []
        ];

        // Sugestão de lente
        $lensRecommendations = [];
        
        // Grande angular: ideal para paisagens amplas, espelhagens, céus dramáticos
        if (($waterConditions['mirror_quality'] ?? '') === 'excelente' || 
            ($waterConditions['mirror_quality'] ?? '') === 'muito boa') {
            $lensRecommendations[] = [
                'type' => 'grande angular',
                'reason' => 'Ideal para capturar espelhagens e paisagens amplas',
                'priority' => 'alta'
            ];
        }
        
        if ($clouds >= 20 && $clouds <= 50 && ($cloudDetails['type'] ?? '') !== 'stratus') {
            $lensRecommendations[] = [
                'type' => 'grande angular',
                'reason' => 'Perfeito para capturar céus dramáticos com nuvens',
                'priority' => 'alta'
            ];
        }
        
        // Teleobjetiva: para detalhes, compressão de planos, isolamento de elementos
        if ($visibility >= 10 && $clouds < 30) {
            $lensRecommendations[] = [
                'type' => 'teleobjetiva',
                'reason' => 'Boa visibilidade permite capturar detalhes distantes e comprimir planos',
                'priority' => 'média'
            ];
        }
        
        if (($cloudDetails['type'] ?? '') === 'cirrus' && $clouds >= 15 && $clouds <= 40) {
            $lensRecommendations[] = [
                'type' => 'teleobjetiva',
                'reason' => 'Nuvens Cirrus criam padrões interessantes que ficam bem com compressão',
                'priority' => 'média'
            ];
        }
        
        // Normal: versátil, sempre útil
        $lensRecommendations[] = [
            'type' => 'normal',
            'reason' => 'Lente versátil, sempre útil para qualquer situação',
            'priority' => 'baixa'
        ];
        
        // Ordenar por prioridade
        usort($lensRecommendations, function($a, $b) {
            $priorityOrder = ['alta' => 3, 'média' => 2, 'baixa' => 1];
            return $priorityOrder[$b['priority']] - $priorityOrder[$a['priority']];
        });
        
        $suggestions['lens'] = [
            'primary' => $lensRecommendations[0] ?? null,
            'alternatives' => array_slice($lensRecommendations, 1, 2)
        ];

        // Sugestão de tripé
        $tripodRecommendations = [];
        $tripodNeeded = false;
        $tripodReasons = [];
        
        // Tripé necessário para longas exposições
        if ($windSpeed < 3) {
            $tripodNeeded = true;
            $tripodReasons[] = 'Vento calmo permite longas exposições sem trepidação';
        }
        
        if (($waterConditions['mirror_quality'] ?? '') === 'excelente') {
            $tripodNeeded = true;
            $tripodReasons[] = 'Condições de espelhagem ideais - use tripé para estabilidade';
        }
        
        if (($photometry['brightness']['level'] ?? '') === 'baixa' || 
            ($photometry['brightness']['level'] ?? '') === 'média') {
            $tripodNeeded = true;
            $tripodReasons[] = 'Luz baixa requer velocidades de obturador mais lentas';
        }
        
        if ($windSpeed > 10) {
            $tripodReasons[] = 'Vento forte - tripé essencial para estabilidade';
            $tripodNeeded = true;
        }
        
        $suggestions['tripod'] = [
            'recommended' => $tripodNeeded,
            'priority' => $tripodNeeded ? 'alta' : 'média',
            'reasons' => $tripodReasons,
            'note' => $tripodNeeded 
                ? 'Tripé altamente recomendado para melhores resultados' 
                : 'Tripé pode ser útil mas não essencial'
        ];

        // Sugestão de filtros
        $filterRecommendations = [];
        
        // Filtro ND (Neutral Density): reduz luz, permite longas exposições
        if (($photometry['brightness']['level'] ?? '') === 'alta' || 
            ($photometry['brightness']['level'] ?? '') === 'média-alta') {
            $filterRecommendations[] = [
                'type' => 'ND (Neutral Density)',
                'reason' => 'Céu muito brilhante - filtro ND permite controlar exposição e criar efeitos de movimento',
                'priority' => 'alta',
                'strength' => 'ND 6-stop ou ND 10-stop para longas exposições'
            ];
        }
        
        if (($waterConditions['mirror_quality'] ?? '') === 'excelente' && $windSpeed < 3) {
            $filterRecommendations[] = [
                'type' => 'ND (Neutral Density)',
                'reason' => 'Água calma + céu brilhante - ideal para longas exposições de água',
                'priority' => 'alta',
                'strength' => 'ND 6-stop para suavizar água'
            ];
        }
        
        // Filtro Polarizador: reduz reflexos, aumenta saturação
        if (($waterConditions['mirror_quality'] ?? '') === 'excelente' || 
            ($waterConditions['mirror_quality'] ?? '') === 'muito boa') {
            $filterRecommendations[] = [
                'type' => 'Polarizador',
                'reason' => 'Reduz reflexos indesejados e aumenta saturação de cores',
                'priority' => 'média',
                'note' => 'Gire o filtro para controlar o nível de polarização'
            ];
        }
        
        if ($clouds < 30 && ($photometry['color_intensity'] ?? '') !== 'muito alta') {
            $filterRecommendations[] = [
                'type' => 'Polarizador',
                'reason' => 'Aumenta saturação do céu azul e realça nuvens brancas',
                'priority' => 'média'
            ];
        }
        
        // Filtro Gradiente: equilibra diferença de exposição entre céu e terra
        if (($photometry['contrast']['level'] ?? '') === 'alto' || 
            (($cloudDetails['type'] ?? '') === 'cirrus' && $clouds >= 20 && $clouds <= 50)) {
            $filterRecommendations[] = [
                'type' => 'Gradiente (GND)',
                'reason' => 'Alto contraste entre céu e terra - filtro gradiente equilibra a exposição',
                'priority' => 'alta',
                'strength' => 'GND 0.6 (2-stop) ou GND 0.9 (3-stop) dependendo do contraste'
            ];
        }
        
        if (($photometry['brightness']['level'] ?? '') === 'alta' && 
            ($cloudDetails['type'] ?? '') !== 'stratus') {
            $filterRecommendations[] = [
                'type' => 'Gradiente (GND)',
                'reason' => 'Céu muito brilhante no nascer/pôr do sol - gradiente escurece apenas o céu',
                'priority' => 'média',
                'strength' => 'GND 0.6 (2-stop)'
            ];
        }
        
        // Ordenar filtros por prioridade
        usort($filterRecommendations, function($a, $b) {
            $priorityOrder = ['alta' => 3, 'média' => 2, 'baixa' => 1];
            return $priorityOrder[$b['priority']] - $priorityOrder[$a['priority']];
        });
        
        $suggestions['filters'] = [
            'primary' => $filterRecommendations[0] ?? null,
            'alternatives' => array_slice($filterRecommendations, 1, 2),
            'note' => !empty($filterRecommendations) 
                ? 'Filtros podem melhorar significativamente a qualidade da imagem' 
                : 'Filtros opcionais - condições permitem fotografia sem filtros'
        ];

        return $suggestions;
    }
}
