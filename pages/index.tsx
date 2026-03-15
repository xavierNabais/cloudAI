import { useState, useEffect } from 'react';
import axios from 'axios';
import WeatherCard from '../components/WeatherCard';
import CitySearch from '../components/CitySearch';

export default function Home() {
    const [city, setCity] = useState('Lisboa');
    const [weatherData, setWeatherData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [forecastDays, setForecastDays] = useState(5);

    const fetchWeather = async (cityName = city) => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(`/api/weather/${encodeURIComponent(cityName)}`, {
                params: { days: forecastDays }
            });
            setWeatherData(response.data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Erro ao buscar dados meteorológicos');
            setWeatherData(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWeather();
    }, []);

    const handleCityChange = (newCity: string) => {
        setCity(newCity);
        fetchWeather(newCity);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                        📸 Condições para Fotografia
                    </h1>
                    <p className="text-gray-600 dark:text-gray-300">
                        Previsão meteorológica otimizada para fotografia de paisagem
                    </p>
                </div>

                <CitySearch 
                    onCitySelect={handleCityChange} 
                    currentCity={city}
                    forecastDays={forecastDays}
                    onForecastDaysChange={setForecastDays}
                />

                {loading && (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        <p className="mt-4 text-gray-600 dark:text-gray-300">A carregar dados meteorológicos...</p>
                    </div>
                )}

                {error && (
                    <div className="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg mb-6">
                        <p className="font-bold">Erro:</p>
                        <p>{error}</p>
                    </div>
                )}

                {weatherData && !loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {weatherData.forecast.map((day: any, index: number) => (
                            <WeatherCard key={index} data={day} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
