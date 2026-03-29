import { createFileRoute } from '@tanstack/react-router'
import WeatherPage from '@/app/dashboard/weather/page'

export const Route = createFileRoute('/dashboard/weather')({
  component: WeatherPage,
})
