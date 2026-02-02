
import React, { useState, useRef } from 'react';
import { 
  FolderOpen, FileSpreadsheet, Play, Download, AlertCircle, 
  Trash2, FileCheck, Layers, Terminal, Database, Clock, Settings, Filter
} from 'lucide-react';
import { PipelineService } from './services/pipelineService';
import { PipelineConfig, LogEntry } from './types';
import { EXCLUDED_CONSTR_TYPES, EXCLUDED_KEYWORDS } from './constants';

const pipeline = new PipelineService();

const App: React.FC = () => {
  const [whobuildsFiles, setWhobuildsFiles] = useState<File[]>([]);
  const [narajangFile, setNarajangFile] = useState<File | null>(null);
  const [masterFile, setMasterFile] = useState<File | null>(null);
  
  // Dynamic Configuration States
  const [chunkSize, setChunkSize] = useState(500);
  const [completionOffset, setCompletionOffset] = useState(30);
  const [minAmount, setMinAmount] = useState(10000000);
  const [excludedTypesStr, setExcludedTypesStr] = useState(EXCLUDED_CONSTR_TYPES.join(', '));
  const [excludedKeywordsStr, setExcludedKeywordsStr] = useState(EXCLUDED_KEYWORDS.join(', '));

  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [results, setResults] = useState<any>(null);

  const logContainerRef = useRef<HTMLDivElement>(null);

  const handleWhobuildsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setWhobuildsFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const executePipeline = async () => {
    // Process what is available
    if (whobuildsFiles.length === 0 && !narajangFile) {
      alert("처리할 데이터 파일(후빌즈 또는 조달청)을 최소 하나 이상 업로드해주세요.");
      return;
    }

    setIsProcessing(true);
    setResults(null);
    setLogs([]);

    try {
      const config: PipelineConfig = {
        chunkSize,
        today: new Date(),
        completionOffsetDays: completionOffset,
        minContractAmount: minAmount,
        excludedTypes: excludedTypesStr.split(',').map(s => s.trim()).filter(s => s !== ""),
        excludedKeywords: excludedKeywordsStr.split(',').map(s => s.trim()).filter(s => s !== "")
      };

      const result = await pipeline.runPipeline(
        whobuildsFiles,
        narajangFile,
        masterFile,
        config
      );

      setResults(result);
      setLogs([...pipeline.getLogs()]);
    } catch (err: any) {
      const errorMsg = `오류 발생: ${err.message}`;
      pipeline.getLogs().push({
        timestamp: new Date().toLocaleTimeString(),
        level: 'error',
        message: errorMsg
      });
      setLogs([...pipeline.getLogs()]);
      alert(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadAll = () => {
    if (!results) return;
    const { resultDf, duplicates, updatedMaster, dateTag, chunkSize } = results;

    if (duplicates.length > 0) {
      pipeline.exportExcel(duplicates, `잠재기회_중복데이터_${dateTag}.xlsx`);
    }
    pipeline.exportExcel(resultDf, `잠재기회_업로드양식_${dateTag}.xlsx`);
    pipeline.exportExcel(updatedMaster, `잠재기회_통합파일_${dateTag}.xlsx`);

    const numChunks = Math.ceil(resultDf.length / chunkSize);
    for (let i = 0; i < numChunks; i++) {
      const chunk = resultDf.slice(i * chunkSize, (i + 1) * chunkSize);
      const chunkData = chunk.map((p: any, idx: number) => ({ ...p, "No.": idx + 1 }));
      pipeline.exportExcel(chunkData, `잠재기회_데이터_${String(i + 1).padStart(2, '0')}.xlsx`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Layers className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Construction Data Pipeline</h1>
            <p className="text-xs text-gray-500 font-medium tracking-wide">Configurable Pipeline Engine v2.5</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={executePipeline}
            disabled={isProcessing}
            className={`flex items-center gap-2 px-8 py-2.5 rounded-full font-bold transition-all ${
              isProcessing 
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-lg shadow-blue-200'
            }`}
          >
            {isProcessing ? <Clock className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
            {isProcessing ? '처리 중...' : '데이터 파이프라인 실행'}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Sidebar Left: Inputs */}
        <section className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-500" />
              파일 입력
            </h2>
            
            <div className="space-y-4">
              {/* Whobuilds */}
              <div>
                <div className="flex justify-between mb-2">
                   <label className="text-sm font-semibold text-gray-700">후빌즈</label>
                   <span className="text-[10px] text-gray-400 font-bold uppercase">Optional</span>
                </div>
                <div className="relative group">
                  <input type="file" multiple onChange={handleWhobuildsUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center bg-gray-50 group-hover:bg-blue-50 group-hover:border-blue-400 transition-colors">
                    <FolderOpen className="w-8 h-8 text-gray-400 mb-1" />
                    <span className="text-[11px] text-gray-500 text-center font-medium">복수 선택 가능</span>
                  </div>
                </div>
                {whobuildsFiles.length > 0 && (
                  <div className="mt-2 text-[11px] font-bold text-blue-600 flex items-center justify-between bg-blue-50 px-2 py-1 rounded">
                    <span>{whobuildsFiles.length}개 선택</span>
                    <button onClick={() => setWhobuildsFiles([])} className="text-red-500 hover:underline">삭제</button>
                  </div>
                )}
              </div>

              {/* Narajang */}
              <div>
                <div className="flex justify-between mb-2">
                   <label className="text-sm font-semibold text-gray-700">조달청(G2B)</label>
                   <span className="text-[10px] text-gray-400 font-bold uppercase">Optional</span>
                </div>
                <div className="relative group">
                  <input type="file" onChange={(e) => setNarajangFile(e.target.files ? e.target.files[0] : null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                  <div className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center transition-colors ${narajangFile ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50'}`}>
                    <FileSpreadsheet className={`w-8 h-8 mb-1 ${narajangFile ? 'text-green-500' : 'text-gray-400'}`} />
                    <span className="text-[11px] font-medium truncate max-w-full">{narajangFile ? narajangFile.name : '단일 엑셀 업로드'}</span>
                  </div>
                </div>
              </div>

              {/* Existing Master */}
              <div>
                <div className="flex justify-between mb-2">
                   <label className="text-sm font-semibold text-gray-700">기존 통합 파일</label>
                   <span className="text-[10px] text-gray-400 font-bold uppercase">Optional</span>
                </div>
                <div className="relative group">
                  <input type="file" onChange={(e) => setMasterFile(e.target.files ? e.target.files[0] : null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                  <div className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center transition-colors ${masterFile ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 bg-gray-50'}`}>
                    <FileCheck className={`w-8 h-8 mb-1 ${masterFile ? 'text-indigo-500' : 'text-gray-400'}`} />
                    <span className="text-[11px] font-medium truncate max-w-full">{masterFile ? masterFile.name : '중복 체크용'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Center: Advanced Filter Settings */}
        <section className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Filter className="w-5 h-5 text-indigo-500" />
              필터 및 전처리 설정
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">준공일 제한 (오늘 + N일)</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="range" min="0" max="365" step="1"
                      value={completionOffset}
                      onChange={(e) => setCompletionOffset(Number(e.target.value))}
                      className="flex-1 accent-blue-600"
                    />
                    <span className="text-sm font-black text-blue-600 w-12 text-right">{completionOffset}일</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">오늘로부터 {completionOffset}일 이후 준공 데이터만 수집</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">조달청 최소 계약금액 (원)</label>
                  <input 
                    type="number" 
                    value={minAmount}
                    onChange={(e) => setMinAmount(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-50 border rounded-xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-green-400 transition-all"
                    placeholder="예: 10000000"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">{minAmount.toLocaleString()}원 이상만 필터링</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">파일 분할 행수 (Chunk)</label>
                  <input 
                    type="number" 
                    value={chunkSize}
                    onChange={(e) => setChunkSize(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-50 border rounded-xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">제외 공종 리스트 (쉼표 구분)</label>
                  <textarea 
                    value={excludedTypesStr}
                    onChange={(e) => setExcludedTypesStr(e.target.value)}
                    className="w-full h-[80px] px-4 py-3 bg-gray-50 border rounded-xl text-xs font-medium text-gray-600 outline-none focus:ring-2 focus:ring-red-400 transition-all resize-none"
                    placeholder="공종명을 입력하세요..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">제외 키워드 리스트 (쉼표 구분)</label>
                  <textarea 
                    value={excludedKeywordsStr}
                    onChange={(e) => setExcludedKeywordsStr(e.target.value)}
                    className="w-full h-[120px] px-4 py-3 bg-gray-50 border rounded-xl text-xs font-medium text-gray-600 outline-none focus:ring-2 focus:ring-red-400 transition-all resize-none"
                    placeholder="공사명에 포함될 경우 제외할 키워드들..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Logs */}
          <div className="bg-gray-900 rounded-2xl shadow-xl overflow-hidden flex flex-col h-[350px]">
            <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Execution Console</span>
              </div>
              <button onClick={() => setLogs([])} className="text-gray-500 hover:text-white transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div ref={logContainerRef} className="flex-1 overflow-y-auto p-5 font-mono text-[12px] leading-relaxed space-y-1 bg-[radial-gradient(circle_at_50%_0%,_#1a1a1a_0%,_#111_100%)]">
              {logs.length === 0 ? (
                <div className="text-gray-700 italic">설정 완료 후 파이프라인을 실행하십시오.</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="flex gap-4">
                    <span className="text-gray-600 opacity-50 shrink-0">[{log.timestamp}]</span>
                    <span className={
                      log.level === 'error' ? 'text-red-400 font-bold' : 
                      log.level === 'warning' ? 'text-amber-300' : 
                      log.level === 'success' ? 'text-emerald-400' : 'text-blue-300'
                    }>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Sidebar Right: Results */}
        <section className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border p-6 sticky top-24">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-green-500" />
              결과 요약
            </h2>
            
            {results ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider mb-1">New Unique Records</p>
                    <p className="text-3xl font-black text-blue-700">{results.resultDf.length}</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl">
                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-wider mb-1">Duplicates Skipped</p>
                    <p className="text-2xl font-black text-amber-600">{results.duplicates.length}</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider mb-1">Updated Master Size</p>
                    <p className="text-2xl font-black text-emerald-600">{results.updatedMaster.length}</p>
                  </div>
                </div>

                <button 
                  onClick={downloadAll}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 active:scale-[0.98]"
                >
                  <Download className="w-5 h-5" />
                  파일 일괄 다운로드
                </button>
                <p className="text-[10px] text-gray-400 text-center px-2">중복 데이터, 업로드 양식, 통합파일, 분할파일이 모두 저장됩니다.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
                <Database className="w-12 h-12 mb-4 text-gray-300" />
                <p className="text-sm font-medium text-gray-500">데이터가 처리되면<br/>요약 및 다운로드 버튼이 활성화됩니다.</p>
              </div>
            )}

            <div className="mt-8 pt-6 border-t">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Settings className="w-3 h-3" />
                시스템 안내
              </h3>
              <div className="space-y-3">
                 <div className="flex gap-3 text-[11px] text-gray-500 bg-gray-50 p-3 rounded-lg border">
                   <AlertCircle className="w-4 h-4 text-blue-500 shrink-0" />
                   <p>브라우저 메모리 기반 처리로 외부 서버에 데이터가 저장되지 않습니다.</p>
                 </div>
                 <div className="flex gap-3 text-[11px] text-gray-500 bg-gray-50 p-3 rounded-lg border">
                   <Filter className="w-4 h-4 text-amber-500 shrink-0" />
                   <p>공사명 필터링 시 대소문자를 구분하지 않습니다.</p>
                 </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <footer className="bg-white border-t py-6 text-center">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-400 font-medium tracking-tight">© 2024 Construction Data Pipeline Pro. Built for Professional Civil Engineering Workflows.</p>
          <div className="flex gap-4">
            <span className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">v2.5 CONFIGURABLE</span>
            <span className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">SECURE BROWSER ENGINE</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
