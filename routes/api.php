<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\WeatherController;
use App\Http\Controllers\Api\CityController;

Route::get('/weather/{city}', [WeatherController::class, 'getWeather']);
Route::get('/cities/search', [CityController::class, 'search']);
