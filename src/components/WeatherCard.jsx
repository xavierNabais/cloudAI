import React, { useState } from 'react';

function WeatherCard({ data }) {
    if (!data) {
        return null;
    }

    const [expandedSections, setExpandedSections] = useState({
        sun: true,
        atmospheric: false,
        water: false,
        photometry: false,
        equipment: false
    });

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'excelente':
                return 'bg-green-100 dark:bg-green-900 border-green-500 text-green-800 dark:text-green-200';
            case 'bom':
                return 'bg-blue-100 dark:bg-blue-900 border-blue-500 text-blue-800 dark:text-blue-200';
            case 'razoavel':
                return 'bg-yellow-100 dark:bg-yellow-900 border-yellow-500 text-yellow-800 dark:text-yellow-200';
            case 'mau':
                return 'bg-red-100 dark:bg-red-900 border-red-500 text-red-800 dark:text-red-200';
            default:
                return 'bg-gray-100 dark:bg-gray-800 border-gray-500 text-gray-800 dark:text-gray-200';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'excelente':
                return '⭐';
            case 'bom':
                return '✅';
            case 'razoavel':
                return '⚠️';
            case 'mau':
                return '❌';
            default:
                return '❓';
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Data não disponível';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('pt-PT', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long' 
            });
        } catch (e) {
            return dateString;
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {formatDate(data?.date)}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {data?.description || 'Sem descrição'}
                    </p>
                </div>
                <div className={`px-3 py-1 rounded-full border-2 ${getStatusColor(data?.photography_status || 'razoavel')}`}>
                    <span className="text-sm font-semibold">
                        {getStatusIcon(data?.photography_status || 'razoavel')} {(data?.photography_status || 'razoavel').toUpperCase()}
                    </span>
                </div>
            </div>

            <div className="space-y-4">
                {/* Informações básicas */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">🌡️ Temp.</span>
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">
                            {data?.temperature || 'N/A'}°C
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">👁️ Visibilidade</span>
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">
                            {data?.visibility || 'N/A'} km
                        </span>
                    </div>
                </div>

                {/* 1️⃣ Qualidade do nascer/pôr do sol */}
                <div className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                    <button
                        onClick={() => toggleSection('sun')}
                        className="w-full flex items-center justify-between mb-2"
                    >
                        <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            ☀️ Nascer/Pôr do Sol
                        </h4>
                        <span className="text-gray-500">{expandedSections.sun ? '▼' : '▶'}</span>
                    </button>
                    {expandedSections.sun && data.sun_info && (
                            <div className="space-y-3 text-sm">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <span className="text-gray-600 dark:text-gray-400">Nascer:</span>
                                        <span className="font-semibold ml-2 text-gray-900 dark:text-white">
                                            {data.sun_info.sunrise}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600 dark:text-gray-400">Pôr:</span>
                                        <span className="font-semibold ml-2 text-gray-900 dark:text-white">
                                            {data.sun_info.sunset}
                                        </span>
                                    </div>
                                </div>
                                
                                {data.sun_info.golden_hour && (
                                    <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded p-2">
                                        <div className="font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
                                            🌅 Golden Hour
                                        </div>
                                        <div className="text-xs text-gray-700 dark:text-gray-300">
                                            <div>Manhã: {data.sun_info.golden_hour.morning.start} - {data.sun_info.golden_hour.morning.end}</div>
                                            <div>Tarde: {data.sun_info.golden_hour.evening.start} - {data.sun_info.golden_hour.evening.end}</div>
                                        </div>
                                    </div>
                                )}
                                
                                {data.sun_info.blue_hour && (
                                    <div className="bg-blue-100 dark:bg-blue-900/30 rounded p-2">
                                        <div className="font-semibold text-blue-800 dark:text-blue-200 mb-1">
                                            🌆 Blue Hour
                                        </div>
                                        <div className="text-xs text-gray-700 dark:text-gray-300">
                                            <div>Manhã: {data.sun_info.blue_hour.morning.start} - {data.sun_info.blue_hour.morning.end}</div>
                                            <div>Tarde: {data.sun_info.blue_hour.evening.start} - {data.sun_info.blue_hour.evening.end}</div>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <span className="text-gray-600 dark:text-gray-400">Nascer:</span>
                                        <div className="font-semibold text-gray-900 dark:text-white">
                                            {data.sun_info.sunrise_direction} ({data.sun_info.sunrise_azimuth}°)
                                        </div>
                                        <div className="text-gray-500 dark:text-gray-400">
                                            Elevação: {data.sun_info.sunrise_elevation}°
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-gray-600 dark:text-gray-400">Pôr:</span>
                                        <div className="font-semibold text-gray-900 dark:text-white">
                                            {data.sun_info.sunset_direction} ({data.sun_info.sunset_azimuth}°)
                                        </div>
                                        <div className="text-gray-500 dark:text-gray-400">
                                            Elevação: {data.sun_info.sunset_elevation}°
                                        </div>
                                    </div>
                                </div>
                            </div>
                    )}
                    {expandedSections.sun && !data.sun_info && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                            Carregando informações do sol...
                        </div>
                    )}
                </div>

                {/* 2️⃣ Nuances das nuvens */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-gray-700 dark:text-gray-300 font-bold">🌤️ Nuances das Nuvens</span>
                        <span className="text-lg font-bold text-blue-700 dark:text-blue-300">
                            {data.clouds}%
                        </span>
                    </div>
                    {data.cloud_details && (
                        <div className="space-y-2 text-sm">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <span className="text-gray-600 dark:text-gray-400">Tipo:</span>
                                    <div className="font-semibold capitalize text-gray-900 dark:text-white">
                                        {data.cloud_details.type}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-gray-600 dark:text-gray-400">Altura:</span>
                                    <div className="font-semibold capitalize text-gray-900 dark:text-white">
                                        {data.cloud_details.height}
                                    </div>
                                </div>
                            </div>
                            
                            {data.cloud_details.coverage_range && (
                                <div className="bg-blue-100 dark:bg-blue-900/30 rounded p-2">
                                    <div className="text-xs text-gray-700 dark:text-gray-300">
                                        <div>Cobertura: {data.cloud_details.coverage_range.min}% - {data.cloud_details.coverage_range.max}%</div>
                                        <div>Variação: {data.cloud_details.coverage_range.variation}%</div>
                                    </div>
                                </div>
                            )}
                            
                            {data.cloud_details.distribution && (
                                <div>
                                    <span className="text-gray-600 dark:text-gray-400 text-xs">Distribuição:</span>
                                    <div className="font-semibold text-gray-900 dark:text-white capitalize">
                                        {data.cloud_details.distribution.pattern}
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400 italic">
                                        {data.cloud_details.distribution.description}
                                    </div>
                                    {data.cloud_details.distribution.horizon_concentration && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            Concentração: {data.cloud_details.distribution.horizon_concentration}
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {data.cloud_details.movement && (
                                <div>
                                    <span className="text-gray-600 dark:text-gray-400 text-xs">Movimento:</span>
                                    <div className="font-semibold text-gray-900 dark:text-white capitalize">
                                        {data.cloud_details.movement.speed}
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400 italic">
                                        {data.cloud_details.movement.description}
                                    </div>
                                </div>
                            )}
                            
                            {data.cloud_details.description && (
                                <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-700 text-xs italic text-gray-700 dark:text-gray-300">
                                    {data.cloud_details.description}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 3️⃣ Água e espelhagem */}
                <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-4 border border-cyan-200 dark:border-cyan-800">
                    <button
                        onClick={() => toggleSection('water')}
                        className="w-full flex items-center justify-between mb-2"
                    >
                        <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            💧 Água e Espelhagem
                        </h4>
                        <span className="text-gray-500">{expandedSections.water ? '▼' : '▶'}</span>
                    </button>
                    {expandedSections.water && data.water_conditions && (
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Qualidade:</span>
                                    <span className={`font-semibold px-2 py-1 rounded ${
                                        data.water_conditions.mirror_quality === 'excelente' ? 'bg-green-200 dark:bg-green-800' :
                                        data.water_conditions.mirror_quality === 'muito boa' ? 'bg-blue-200 dark:bg-blue-800' :
                                        data.water_conditions.mirror_quality === 'boa' ? 'bg-yellow-200 dark:bg-yellow-800' :
                                        'bg-red-200 dark:bg-red-800'
                                    }`}>
                                        {data.water_conditions.mirror_quality}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-700 dark:text-gray-300 italic">
                                    {data.water_conditions.mirror_description}
                                </p>
                                <div className="text-xs">
                                    <div>Vento: {data.water_conditions.wind_for_water.speed} km/h</div>
                                    <div>Risco de neblina sobre água: {data.water_conditions.water_fog_risk}</div>
                                </div>
                                <p className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                                    💡 {data.water_conditions.recommendation}
                                </p>
                            </div>
                    )}
                    {expandedSections.water && !data.water_conditions && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                            Carregando condições de água...
                        </div>
                    )}
                </div>

                {/* 4️⃣ Condições atmosféricas */}
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                    <button
                        onClick={() => toggleSection('atmospheric')}
                        className="w-full flex items-center justify-between mb-2"
                    >
                        <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            🌫️ Condições Atmosféricas
                        </h4>
                        <span className="text-gray-500">{expandedSections.atmospheric ? '▼' : '▶'}</span>
                    </button>
                    {expandedSections.atmospheric && data.atmospheric && (
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Humidade:</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {data.atmospheric.humidity}% 
                                        <span className={`ml-2 text-xs ${
                                            data.atmospheric.humidity_risk === 'alto' ? 'text-red-600' :
                                            data.atmospheric.humidity_risk === 'médio' ? 'text-yellow-600' :
                                            'text-green-600'
                                        }`}>
                                            ({data.atmospheric.humidity_risk})
                                        </span>
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Pressão:</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {data.atmospheric.pressure} hPa
                                    </span>
                                </div>
                                {data.atmospheric.fog_mist && (
                                    <div className="bg-gray-200 dark:bg-gray-700 rounded p-2">
                                        <div className="font-semibold text-gray-900 dark:text-white">
                                            Neblina/Nevoeiro: {data.atmospheric.fog_intensity}
                                        </div>
                                        <div className="text-xs text-gray-600 dark:text-gray-400">
                                            Pode afetar cores do sol
                                        </div>
                                    </div>
                                )}
                                {data.atmospheric.precipitation.total > 0 && (
                                    <div className="bg-blue-200 dark:bg-blue-800 rounded p-2">
                                        <div className="font-semibold text-gray-900 dark:text-white">
                                            {data.atmospheric.precipitation.type}: {data.atmospheric.precipitation.total}mm
                                        </div>
                                        <div className="text-xs text-gray-600 dark:text-gray-400">
                                            Intensidade: {data.atmospheric.precipitation.intensity}
                                        </div>
                                    </div>
                                )}
                            </div>
                    )}
                    {expandedSections.atmospheric && !data.atmospheric && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                            Carregando condições atmosféricas...
                        </div>
                    )}
                </div>

                {/* 5️⃣ Fotometria e cores */}
                <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-4 border border-pink-200 dark:border-pink-800">
                    <button
                        onClick={() => toggleSection('photometry')}
                        className="w-full flex items-center justify-between mb-2"
                    >
                        <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            🎨 Fotometria e Cores
                        </h4>
                        <span className="text-gray-500">{expandedSections.photometry ? '▼' : '▶'}</span>
                    </button>
                    {expandedSections.photometry && data.photometry && (
                            <div className="space-y-3 text-sm">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-gray-600 dark:text-gray-400">Dispersão da Luz:</span>
                                        <span className="font-bold text-pink-700 dark:text-pink-300">
                                            {data.photometry.light_scattering.index}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                        <div 
                                            className="bg-pink-500 h-2 rounded-full"
                                            style={{ width: `${data.photometry.light_scattering.index}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">
                                        {data.photometry.light_scattering.description}
                                    </p>
                                    <span className={`text-xs px-2 py-1 rounded mt-1 inline-block ${
                                        data.photometry.light_scattering.quality === 'excelente' ? 'bg-green-200 dark:bg-green-800' :
                                        data.photometry.light_scattering.quality === 'boa' ? 'bg-blue-200 dark:bg-blue-800' :
                                        'bg-yellow-200 dark:bg-yellow-800'
                                    }`}>
                                        {data.photometry.light_scattering.quality}
                                    </span>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <span className="text-gray-600 dark:text-gray-400">Brilho:</span>
                                        <div className="font-semibold text-gray-900 dark:text-white capitalize">
                                            {data.photometry.brightness.level}
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {data.photometry.brightness.description}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-gray-600 dark:text-gray-400">Contraste:</span>
                                        <div className="font-semibold text-gray-900 dark:text-white capitalize">
                                            {data.photometry.contrast.level}
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {data.photometry.contrast.description}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="bg-pink-100 dark:bg-pink-900/30 rounded p-2">
                                    <div className="font-semibold text-pink-800 dark:text-pink-200">
                                        Intensidade de Cores: {data.photometry.color_intensity}
                                    </div>
                                </div>
                            </div>
                    )}
                    {expandedSections.photometry && !data.photometry && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                            Carregando informações de fotometria...
                        </div>
                    )}
                </div>

                {/* Vento */}
                {data.wind_direction && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-gray-700 dark:text-gray-300 font-medium">💨 Vento</span>
                            <span className="text-lg font-bold text-gray-900 dark:text-white">
                                {data.wind_speed} km/h
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <span className="text-gray-600 dark:text-gray-400">Direção:</span>
                                <span className="text-2xl" title={`${data.wind_direction.degrees}°`}>
                                    {data.wind_direction.arrow}
                                </span>
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {data.wind_direction.cardinal}
                                </span>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {data.wind_direction.degrees}°
                            </span>
                        </div>
                    </div>
                )}

                {/* 6️⃣ Sugestões de Equipamento */}
                {data.equipment_suggestions && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 border border-indigo-200 dark:border-indigo-800">
                        <button
                            onClick={() => toggleSection('equipment')}
                            className="w-full flex items-center justify-between mb-2"
                        >
                            <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                📷 Sugestões de Equipamento
                            </h4>
                            <span className="text-gray-500">{expandedSections.equipment ? '▼' : '▶'}</span>
                        </button>
                        {expandedSections.equipment && (
                            <div className="space-y-4 text-sm">
                                {/* Lente */}
                                {data.equipment_suggestions.lens && data.equipment_suggestions.lens.primary && (
                                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-indigo-200 dark:border-indigo-700">
                                        <div className="font-semibold text-indigo-800 dark:text-indigo-200 mb-2 flex items-center gap-2">
                                            🔍 Lente Recomendada
                                        </div>
                                        <div className="space-y-2">
                                            <div>
                                                <div className="font-bold text-gray-900 dark:text-white capitalize">
                                                    {data.equipment_suggestions.lens.primary.type}
                                                </div>
                                                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                    {data.equipment_suggestions.lens.primary.reason}
                                                </div>
                                                <span className={`text-xs px-2 py-1 rounded mt-1 inline-block ${
                                                    data.equipment_suggestions.lens.primary.priority === 'alta' ? 'bg-red-200 dark:bg-red-800' :
                                                    data.equipment_suggestions.lens.primary.priority === 'média' ? 'bg-yellow-200 dark:bg-yellow-800' :
                                                    'bg-blue-200 dark:bg-blue-800'
                                                }`}>
                                                    Prioridade: {data.equipment_suggestions.lens.primary.priority}
                                                </span>
                                            </div>
                                            {data.equipment_suggestions.lens.alternatives && data.equipment_suggestions.lens.alternatives.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-indigo-200 dark:border-indigo-700">
                                                    <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                                        Alternativas:
                                                    </div>
                                                    {data.equipment_suggestions.lens.alternatives.map((alt, idx) => (
                                                        <div key={idx} className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                            <span className="font-semibold capitalize">{alt.type}:</span> {alt.reason}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Tripé */}
                                {data.equipment_suggestions.tripod && (
                                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-indigo-200 dark:border-indigo-700">
                                        <div className="font-semibold text-indigo-800 dark:text-indigo-200 mb-2 flex items-center gap-2">
                                            🦶 Tripé
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-bold ${
                                                    data.equipment_suggestions.tripod.recommended 
                                                        ? 'text-red-600 dark:text-red-400' 
                                                        : 'text-green-600 dark:text-green-400'
                                                }`}>
                                                    {data.equipment_suggestions.tripod.recommended ? '✅ Recomendado' : '⚪ Opcional'}
                                                </span>
                                                <span className={`text-xs px-2 py-1 rounded ${
                                                    data.equipment_suggestions.tripod.priority === 'alta' ? 'bg-red-200 dark:bg-red-800' :
                                                    'bg-yellow-200 dark:bg-yellow-800'
                                                }`}>
                                                    {data.equipment_suggestions.tripod.priority}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                                                {data.equipment_suggestions.tripod.note}
                                            </p>
                                            {data.equipment_suggestions.tripod.reasons && data.equipment_suggestions.tripod.reasons.length > 0 && (
                                                <div className="mt-2">
                                                    <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                                        Razões:
                                                    </div>
                                                    <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
                                                        {data.equipment_suggestions.tripod.reasons.map((reason, idx) => (
                                                            <li key={idx}>{reason}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Filtros */}
                                {data.equipment_suggestions.filters && (
                                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-indigo-200 dark:border-indigo-700">
                                        <div className="font-semibold text-indigo-800 dark:text-indigo-200 mb-2 flex items-center gap-2">
                                            🎨 Filtros
                                        </div>
                                        <div className="space-y-3">
                                            {data.equipment_suggestions.filters.primary && (
                                                <div>
                                                    <div className="font-bold text-gray-900 dark:text-white">
                                                        {data.equipment_suggestions.filters.primary.type}
                                                    </div>
                                                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                        {data.equipment_suggestions.filters.primary.reason}
                                                    </div>
                                                    {data.equipment_suggestions.filters.primary.strength && (
                                                        <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-1">
                                                            Força: {data.equipment_suggestions.filters.primary.strength}
                                                        </div>
                                                    )}
                                                    {data.equipment_suggestions.filters.primary.note && (
                                                        <div className="text-xs italic text-gray-500 dark:text-gray-400 mt-1">
                                                            {data.equipment_suggestions.filters.primary.note}
                                                        </div>
                                                    )}
                                                    <span className={`text-xs px-2 py-1 rounded mt-1 inline-block ${
                                                        data.equipment_suggestions.filters.primary.priority === 'alta' ? 'bg-red-200 dark:bg-red-800' :
                                                        data.equipment_suggestions.filters.primary.priority === 'média' ? 'bg-yellow-200 dark:bg-yellow-800' :
                                                        'bg-blue-200 dark:bg-blue-800'
                                                    }`}>
                                                        Prioridade: {data.equipment_suggestions.filters.primary.priority}
                                                    </span>
                                                </div>
                                            )}
                                            {data.equipment_suggestions.filters.alternatives && data.equipment_suggestions.filters.alternatives.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-indigo-200 dark:border-indigo-700">
                                                    <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                                                        Alternativas:
                                                    </div>
                                                    {data.equipment_suggestions.filters.alternatives.map((alt, idx) => (
                                                        <div key={idx} className="mb-2">
                                                            <div className="font-semibold text-gray-900 dark:text-white text-xs">
                                                                {alt.type}
                                                            </div>
                                                            <div className="text-xs text-gray-600 dark:text-gray-400">
                                                                {alt.reason}
                                                            </div>
                                                            {alt.strength && (
                                                                <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-1">
                                                                    {alt.strength}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {data.equipment_suggestions.filters.note && (
                                                <div className="text-xs italic text-gray-600 dark:text-gray-400 mt-2 pt-2 border-t border-indigo-200 dark:border-indigo-700">
                                                    💡 {data.equipment_suggestions.filters.note}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Notas gerais */}
                {data.photography_notes && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                            <strong className="text-gray-900 dark:text-white">📝 Notas:</strong> {data.photography_notes}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default WeatherCard;
