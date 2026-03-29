import { Link } from '@tanstack/react-router'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">404</h1>
        <p className="mt-2 text-gray-600">Page not found</p>
        <Link
          to="/"
          className="mt-4 inline-block text-primary hover:underline"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
