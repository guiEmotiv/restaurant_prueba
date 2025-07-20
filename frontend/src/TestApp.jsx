function TestApp() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-8">
          <div className="uppercase tracking-wide text-sm text-indigo-500 font-semibold">
            Restaurant Management
          </div>
          <h1 className="block mt-1 text-lg leading-tight font-medium text-black">
            Frontend Test
          </h1>
          <p className="mt-2 text-gray-500">
            ✅ React 19 funcionando correctamente
          </p>
          <p className="mt-1 text-gray-500">
            ✅ Tailwind CSS cargado
          </p>
          <p className="mt-1 text-gray-500">
            ✅ Vite servidor activo
          </p>
          <button className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Botón de Prueba
          </button>
        </div>
      </div>
    </div>
  );
}

export default TestApp;