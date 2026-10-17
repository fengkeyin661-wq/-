const fs = require('fs');
const p = 'components/AdminConsole.tsx';
let s = fs.readFileSync(p, 'utf8');
const start = s.indexOf('{checkUploadPending && (');
const end = s.indexOf('{isSmartBatchModalOpen && (');
if (start < 0 || end < 0) {
  console.error('markers not found', start, end);
  process.exit(1);
}
const lines = [
  '{isCheckUploadModalOpen && (',
  '                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center backdrop-blur-sm">',
  '                    <div className="bg-white w-full max-w-3xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scaleIn">',
  '                        <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">',
  '                            <div>',
  '                                <h3 className="text-xl font-bold text-slate-800">历年体检报告导入</h3>',
  '                                <p className="text-xs text-slate-500 mt-1">',
  '                                    自动识别检查日期与 6 位体检编号；无档案时自动建档；按日期升序入库后统一评估',
  '                                </p>',
  '                            </div>',
  '                            <button',
  '                                type="button"',
  '                                onClick={() => {',
  '                                    if (!isCheckUploadProcessing) {',
  '                                        setIsCheckUploadModalOpen(false);',
  '                                        setCheckUploadLogs([]);',
  '                                    }',
  '                                }}',
  '                                className="text-slate-400 hover:text-slate-600 text-2xl font-bold"',
  '                            >',
  '                                ×',
  '                            </button>',
  '                        </div>',
  '                        <div className="flex-1 p-6 overflow-hidden flex flex-col">',
  '                            <div className="flex-1 bg-black rounded-xl p-4 font-mono text-xs text-green-400 overflow-y-auto">',
  '                                {checkUploadLogs.map((log, i) => (',
  '                                    <div key={i} className="mb-1">',
  '                                        {log}',
  '                                    </div>',
  '                                ))}',
  '                                {isCheckUploadProcessing && <motion className="animate-pulse">_</motion>}',
  '                            </div>',
  '                        </div>',
  '                        <div className="p-6 border-t border-slate-200 bg-white flex justify-end">',
  '                            <button',
  '                                type="button"',
  '                                disabled={isCheckUploadProcessing}',
  '                                onClick={() => {',
  '                                    setIsCheckUploadModalOpen(false);',
  '                                    setCheckUploadLogs([]);',
  '                                }}',
  '                                className="px-6 py-2 rounded-lg bg-purple-600 text-white font-bold hover:bg-purple-700 disabled:opacity-50"',
  '                            >',
  '                                关闭',
  '                            </button>',
  '                        </div>',
  '                    </div>',
  '                </div>',
  '            )}',
  '',
  '            ',
];
let rep = lines.join('\n');
rep = rep.replace(/<motion/g, '<div').replace(/<\/motion>/g, '</motion>');
rep = rep.replace(/<\/motion>/g, '</div>');
const out = s.slice(0, start) + rep + s.slice(end);
fs.writeFileSync(p, out);
console.log('done');
