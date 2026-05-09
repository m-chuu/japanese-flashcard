import { Link, useLocation } from 'react-router-dom'

const links = [
  { to: '/', label: 'Cards' },
  { to: '/study', label: 'Study' },
  { to: '/add', label: '+ Add Card' },
]

export default function Navbar() {
  const { pathname } = useLocation()

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="container mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-indigo-700 tracking-tight">
          日本語 FlashCards
        </Link>
        <div className="flex gap-6">
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`text-sm font-medium transition-colors pb-0.5 ${
                pathname === to
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-indigo-600'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
