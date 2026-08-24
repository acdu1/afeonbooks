export function MaintenancePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 px-4">
      <div className="text-center space-y-6 max-w-md">
        {/* SVG Image */}
        <div className="flex justify-center">
          <img 
            src="/totec-maintenence.svg" 
            alt="Maintenance" 
            className="w-48 h-48 object-contain"
          />
        </div>

        {/* Content */}
        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-white">
            Maintenance in Progress
          </h1>
          <p className="text-lg text-slate-300">
            We're working to improve your experience. We'll be back soon!
          </p>
        </div>

        {/* Status Indicator */}
        <div className="pt-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            <span className="text-sm text-yellow-200">Service Unavailable</span>
          </div>
        </div>
      </div>
    </div>
  );
}
