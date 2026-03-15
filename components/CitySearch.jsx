import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// Lista de cidades principais de Portugal para busca rápida local
const PORTUGUESE_CITIES = [
    'Lisboa', 'Porto', 'Braga', 'Coimbra', 'Faro', 'Évora', 'Aveiro', 'Setúbal',
    'Viseu', 'Leiria', 'Funchal', 'Ponta Delgada', 'Vila Nova de Gaia', 'Guimarães',
    'Santarém', 'Bragança', 'Beja', 'Portalegre', 'Viana do Castelo', 'Vila Real',
    'Castelo Branco', 'Angra do Heroísmo', 'Horta', 'Cascais', 'Sintra', 'Almada',
    'Amadora', 'Oeiras', 'Barreiro', 'Seixal', 'Gondomar', 'Matosinhos', 'Maia',
    'Vila do Conde', 'Póvoa de Varzim', 'Esposende', 'Viana do Castelo', 'Caminha',
    'Valença', 'Monção', 'Melgaço', 'Arcos de Valdevez', 'Ponte de Lima'
];

function CitySearch({ onCitySelect, currentCity, forecastDays, onForecastDaysChange }) {
    const [searchTerm, setSearchTerm] = useState(currentCity);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loading, setLoading] = useState(false);
    const debounceTimer = useRef(null);

    // Busca local primeiro nas cidades principais
    const searchLocal = (value) => {
        if (value.length < 2) return [];
        
        const lowerValue = value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return PORTUGUESE_CITIES
            .filter(city => {
                const normalizedCity = city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                return normalizedCity.includes(lowerValue);
            })
            .slice(0, 5)
            .map(city => ({
                name: city,
                country: 'PT',
                state: null,
                local: true
            }));
    };

    const handleSearch = async (value) => {
        setSearchTerm(value);
        
        // Limpar timer anterior
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        if (value.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        // Mostrar resultados locais imediatamente como preview
        const localResults = searchLocal(value);
        if (localResults.length > 0 && value.length >= 2) {
            setSuggestions(localResults);
            setShowSuggestions(true);
        }

        // Busca completa na API com debounce
        debounceTimer.current = setTimeout(async () => {
            if (value.length >= 2) {
                setLoading(true);
                try {
                    const response = await axios.get(`/api/cities/search`, {
                        params: { q: value },
                        timeout: 4000 // Timeout de 4 segundos
                    });
                    
                    const apiResults = response.data || [];
                    
                    // Combinar e ordenar resultados
                    // Priorizar resultados que começam com a busca
                    const normalize = (str) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const normalizedValue = normalize(value);
                    
                    const allResults = [...apiResults];
                    
                    // Adicionar resultados locais que não estão na API
                    localResults.forEach(localCity => {
                        if (!allResults.some(c => normalize(c.name) === normalize(localCity.name))) {
                            allResults.push(localCity);
                        }
                    });
                    
                    // Ordenar: primeiro as que começam com a busca, depois as que contêm
                    const sorted = allResults.sort((a, b) => {
                        const aNorm = normalize(a.name);
                        const bNorm = normalize(b.name);
                        const aStarts = aNorm.startsWith(normalizedValue);
                        const bStarts = bNorm.startsWith(normalizedValue);
                        
                        if (aStarts && !bStarts) return -1;
                        if (!aStarts && bStarts) return 1;
                        return aNorm.localeCompare(bNorm);
                    });
                    
                    setSuggestions(sorted.slice(0, 10)); // Mostrar até 10 resultados
                    setShowSuggestions(true);
                } catch (err) {
                    // Se API falhar, usar apenas resultados locais
                    if (localResults.length > 0) {
                        setSuggestions(localResults);
                        setShowSuggestions(true);
                    } else {
                        setSuggestions([]);
                    }
                } finally {
                    setLoading(false);
                }
            }
        }, 400); // Debounce reduzido para 400ms
    };

    const handleSelectCity = (city) => {
        setSearchTerm(city.name);
        setShowSuggestions(false);
        onCitySelect(city.name);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (searchTerm.trim()) {
            onCitySelect(searchTerm.trim());
        }
    };

    return (
        <div className="mb-8">
            <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 relative">
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Cidade
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            id="city"
                            value={searchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
                            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                            onBlur={() => {
                                // Delay para permitir clique nas sugestões
                                setTimeout(() => setShowSuggestions(false), 200);
                            }}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                            placeholder="Digite o nome da cidade (ex: Lisboa, Porto)..."
                        />
                        {loading && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            </div>
                        )}
                    </div>
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                            <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                {suggestions.length} {suggestions.length === 1 ? 'cidade encontrada' : 'cidades encontradas'}
                            </div>
                            {suggestions.map((city, index) => (
                                <button
                                    key={`${city.name}-${index}`}
                                    type="button"
                                    onClick={() => handleSelectCity(city)}
                                    className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                                >
                                    <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                        {city.name}
                                        {city.local && (
                                            <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-0.5 rounded">
                                                ✓
                                            </span>
                                        )}
                                    </div>
                                    {city.state && (
                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                            {city.state}, Portugal
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="w-full md:w-48">
                    <label htmlFor="days" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Dias de previsão
                    </label>
                    <select
                        id="days"
                        value={forecastDays}
                        onChange={(e) => onForecastDaysChange(Number(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    >
                        <option value={3}>3 dias</option>
                        <option value={5}>5 dias</option>
                        <option value={7}>7 dias</option>
                    </select>
                </div>
                <button
                    type="submit"
                    className="w-full md:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                    Buscar
                </button>
            </form>
        </div>
    );
}

export default CitySearch;
