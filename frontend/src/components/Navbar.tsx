import { Link, useLocation } from 'react-router-dom'

const links = [
  { to: '/', label: 'Cards' },
  { to: '/study', label: 'Study' },
  { to: '/n1', label: 'N1' },
  { to: '/add', label: '+ JP Card' },
  { to: '/add-english', label: '+ EN Card' },
]

export default function Navbar() {
  const { pathname } = useLocation()

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200/60 sticky top-0 z-40">
      <div className="container mx-auto max-w-5xl px-4 py-3.5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl font-extrabold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent tracking-tight">
            FlashCards
          </span>
          <span className="text-lg">🇯🇵🇬🇧</span>
        </Link>
        <div className="flex gap-1">
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                pathname === to
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
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
