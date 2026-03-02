export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">ダッシュボード</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-600 mb-1">算定済み加算数</p>
          <p className="text-3xl font-bold text-emerald-600">0</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-600 mb-1">達成率</p>
          <p className="text-3xl font-bold text-slate-800">0%</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-600 mb-1">未達加算数</p>
          <p className="text-3xl font-bold text-amber-600">0</p>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">ようこそ</h2>
        <p className="text-slate-600">
          組織と店舗を設定すると、加算の進捗が表示されます。
          まずは「データ入力」から実績を登録してください。
        </p>
      </div>
    </div>
  )
}
