<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\WeatherService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class WeatherController extends Controller
{
    protected $weatherService;

    public function __construct(WeatherService $weatherService)
    {
        $this->weatherService = $weatherService;
    }

    public function getWeather(string $city, Request $request): JsonResponse
    {
        try {
            $days = (int) $request->query('days', 5);
            $days = min(max($days, 1), 7); // Limitar entre 1 e 7 dias

            $weatherData = $this->weatherService->getForecastForCity($city, $days);

            return response()->json($weatherData);
        } catch (\Exception $e) {
            \Log::error('Error getting weather', [
                'city' => $city,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'error' => true,
                'message' => $e->getMessage()
            ], 404);
        }
    }
}
