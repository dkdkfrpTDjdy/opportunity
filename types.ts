
export interface ConstructionProject {
  "No.": string | number;
  "시도": string | number;
  "시군구": string | number;
  "공종": string;
  "공사명": string;
  "착공일": string;
  "준공(승인)일": string;
  "주소": string;
  "발주(수요처)": string;
  "시공사": string;
  "시공사연락처": string;
  "건축면적(㎡)": string;
  "지하층수": string | number;
  "지상층수": string | number;
  "세대수": string | number;
  "출처": string;
  "등록일": string;
  "상세공종": string;
  "공사개요": string;
  "최초계약일": string;
  "계약변경차수": string;
  "계약금액": string | number;
  "공동계약여부": string;
  "업체구분": string;
  "주업종": string;
  "사업자번호": string;
  "대지면적(㎡)": string;
  "주구조": string;
  "주용도": string;
  "높이": string;
}

export interface PipelineConfig {
  chunkSize: number;
  today: Date;
  completionOffsetDays: number; // 준공일 제한 (오늘 + N일)
  minContractAmount: number;    // 조달청 최소 계약금액
  excludedTypes: string[];      // 제외 공종 리스트
  excludedKeywords: string[];   // 제외 키워드 리스트
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
}
