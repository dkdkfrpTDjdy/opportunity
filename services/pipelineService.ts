
import * as XLSX from 'xlsx';
import { 
  COLUMNS, CONSTR_MAPPING, DETAIL_CONSTR_MAPPING, 
  REGION_MAPPING, REGION_MAPPING2 
} from '../constants';
import { ConstructionProject, PipelineConfig, LogEntry } from '../types';
import { addDays, format, parse, isValid } from 'date-fns';

export class PipelineService {
  private logs: LogEntry[] = [];

  private log(message: string, level: LogEntry['level'] = 'info') {
    this.logs.push({
      timestamp: new Date().toLocaleTimeString(),
      level,
      message
    });
    console.log(`[${level.toUpperCase()}] ${message}`);
  }

  getLogs() { return this.logs; }
  clearLogs() { this.logs = []; }

  parseDate(dateVal: any): string | null {
    if (!dateVal) return null;
    if (dateVal instanceof Date) return format(dateVal, 'yyyy-MM-dd');
    
    const str = String(dateVal).trim();
    const formats = ['yyyy.MM.dd', 'yyyyMMdd', 'yyyy-MM-dd'];
    
    for (const f of formats) {
      try {
        const d = parse(str, f, new Date());
        if (isValid(d)) return format(d, 'yyyy-MM-dd');
      } catch (e) {}
    }
    return null;
  }

  extractArea(text: string, type: "건축면적" | "대지면적"): string | null {
    const pattern = new RegExp(`${type}.*?(\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?)㎡`, 'i');
    const match = text.match(pattern);
    return match ? match[1].replace(/,/g, '') : null;
  }

  extractFloors(text: string, type: "지상" | "지하"): number | null {
    const pattern = new RegExp(`${type}\\s*(\\d+)(?:층)?`, 'i');
    const match = text.match(pattern);
    return match ? parseInt(match[1]) : null;
  }

  extractHouseholds(text: string): string | null {
    const patterns = [
      /세대수\s*[:：]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/i,
      /세\s*대\s*수\s*[:：]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/i,
      /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*세대(?!수)/i,
      /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*세\s*대(?!\s*수)/i
    ];
    for (const p of patterns) {
      const match = text.match(p);
      if (match) return match[1].replace(/,/g, '');
    }
    return null;
  }

  extractAmount(text: string): string | null {
    const patterns = [
      /금액\s*[:：]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/i,
      /공사비\s*[:：]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/i,
      /공사금액\s*[:：]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/i
    ];
    for (const p of patterns) {
      const match = text.match(p);
      if (match) return match[1].replace(/,/g, '');
    }
    return null;
  }

  cleanProjectName(name: string): string {
    if (!name || name.length <= 4) return name;
    const front = name.substring(0, 4);
    const bracketIndex = front.search(/[\])]/);
    if (bracketIndex !== -1) return name.substring(bracketIndex + 1).trim();
    const fullBracketIndex = name.search(/[\])]/);
    if (fullBracketIndex !== -1) {
      const openingIndex = name.substring(0, fullBracketIndex).search(/[\[(]/);
      if (openingIndex !== -1) {
        const prefix = name.substring(0, openingIndex).trim();
        if (prefix.length <= 3) return name.substring(fullBracketIndex + 1).trim();
      }
    }
    return name;
  }

  containsExcludedKeyword(name: string, keywords: string[]): boolean {
    if (!name) return false;
    const lower = name.toLowerCase();
    return keywords.some(k => lower.includes(k.trim().toLowerCase()));
  }

  mapRegion(address: string): number | "" {
    if (!address) return "";
    for (const [reg, code] of Object.entries(REGION_MAPPING)) {
      if (address.includes(reg)) return code;
    }
    return "";
  }

  mapRegion2(address: string): number | "" {
    if (!address) return "";
    for (const [reg, code] of Object.entries(REGION_MAPPING2)) {
      if (address.includes(reg)) return code;
    }
    return "";
  }

  async runPipeline(
    whobuildsFiles: File[], 
    narajangFile: File | null, 
    masterFile: File | null, 
    config: PipelineConfig
  ) {
    this.clearLogs();
    this.log("Pipeline starting with user-provided configuration...");
    const cutoffDateStr = format(addDays(config.today, config.completionOffsetDays), 'yyyy-MM-dd');
    this.log(`Completion date filter (Cutoff): ${cutoffDateStr} (Today + ${config.completionOffsetDays} days)`);

    let whobuildsData: any[] = [];
    if (whobuildsFiles.length > 0) {
      for (const file of whobuildsFiles) {
        this.log(`Reading Whobuilds file: ${file.name}`);
        const data = await this.readExcel(file);
        whobuildsData = [...whobuildsData, ...data];
      }
      this.log(`Loaded ${whobuildsData.length} records from Whobuilds.`);
    }

    // 1. Process Whobuilds
    const whobuildsProcessed = whobuildsData.map(row => {
      const originalConstr = String(row['공종'] || "");
      const dateRange = String(row['착공일/준공일'] || "").split('~');
      const contactRaw = String(row['전화/팩스'] || "").split('/');
      const overview = String(row['공사개요'] || "");

      const project: ConstructionProject = {
        "No.": "",
        "시도": this.mapRegion(row['주소']),
        "시군구": this.mapRegion2(row['주소']),
        "공종": CONSTR_MAPPING[originalConstr] || "",
        "공사명": row['공사명'],
        "착공일": this.parseDate(dateRange[0]) || "",
        "준공(승인)일": this.parseDate(dateRange[1]) || "",
        "주소": String(row['주소'] || "").replace('일원', ''),
        "발주(수요처)": row['발주처'],
        "시공사": row['시공사'],
        "시공사연락처": (contactRaw[0] || "").replace('h:', '').trim(),
        "건축면적(㎡)": this.extractArea(overview, "건축면적") || "",
        "지하층수": this.extractFloors(overview, "지하") || "",
        "지상층수": this.extractFloors(overview, "지상") || "",
        "세대수": this.extractHouseholds(overview) || "",
        "출처": "01",
        "등록일": this.parseDate(row['등록일']) || "",
        "상세공종": DETAIL_CONSTR_MAPPING[originalConstr] || "",
        "공사개요": overview,
        "최초계약일": "",
        "계약변경차수": "",
        "계약금액": this.extractAmount(overview) || "",
        "공동계약여부": "",
        "업체구분": "",
        "주업종": "",
        "사업자번호": "",
        "대지면적(㎡)": this.extractArea(overview, "대지면적") || "",
        "주구조": "",
        "주용도": "",
        "높이": ""
      };
      (project as any)._originalConstr = originalConstr;
      return project;
    }).filter(p => {
      const isDefenseAgency = String(p["발주(수요처)"]).includes('방위사업청');
      const dateCheck = p["준공(승인)일"] && p["준공(승인)일"] >= cutoffDateStr;
      const constrCheck = !config.excludedTypes.includes((p as any)._originalConstr);
      const keywordCheck = !this.containsExcludedKeyword(p["공사명"], config.excludedKeywords);
      return !isDefenseAgency && dateCheck && constrCheck && keywordCheck;
    });

    if (whobuildsData.length > 0) {
      this.log(`Whobuilds post-filter: ${whobuildsProcessed.length} records.`);
    }

    // 2. Process Narajang
    let narajangProcessed: ConstructionProject[] = [];
    if (narajangFile) {
      this.log(`Reading Narajang file: ${narajangFile.name}`);
      const rawNarajang = await this.readExcel(narajangFile);
      narajangProcessed = rawNarajang.map(row => {
        const originalConstr = String(row['공공조달분류'] || "");
        const project: ConstructionProject = {
          "No.": "",
          "시도": this.mapRegion(row['현장지역']),
          "시군구": this.mapRegion2(row['현장지역']),
          "공종": CONSTR_MAPPING[originalConstr] || "E0",
          "공사명": this.cleanProjectName(row['계약명']),
          "착공일": this.parseDate(row['착수일자']) || "",
          "준공(승인)일": this.parseDate(row['총완수일자']) || "",
          "주소": row['현장지역'] || "",
          "발주(수요처)": row['수요기관'],
          "시공사": row['계약시점 업체명'],
          "시공사연락처": "",
          "건축면적(㎡)": "",
          "지하층수": "",
          "지상층수": "",
          "세대수": "",
          "출처": "02",
          "등록일": this.parseDate(row['기준일자']) || "",
          "상세공종": DETAIL_CONSTR_MAPPING[originalConstr] || "",
          "공사개요": "",
          "최초계약일": this.parseDate(row['최초계약일자']) || "",
          "계약변경차수": row['계약변경차수'] || "",
          "계약금액": row['계약금액'] || 0,
          "공동계약여부": row['공동수급구성방식'] === '단독계약' ? 'N' : 'Y',
          "업체구분": row['계약시점 기업형태구분'] || "",
          "주업종": row['계약시점 업체지역'] || "",
          "사업자번호": row['업체사업자등록번호'] || "",
          "대지면적(㎡)": "",
          "주구조": "",
          "주용도": "",
          "높이": ""
        };
        (project as any)._originalConstr = originalConstr;
        return project;
      }).filter(p => {
        const amt = Number(p["계약금액"]);
        const amtCheck = amt >= config.minContractAmount;
        const dateCheck = p["준공(승인)일"] && p["준공(승인)일"] >= cutoffDateStr;
        const constrCheck = !config.excludedTypes.includes((p as any)._originalConstr);
        const keywordCheck = !this.containsExcludedKeyword(p["공사명"], config.excludedKeywords);
        return amtCheck && dateCheck && constrCheck && keywordCheck;
      });
      this.log(`Narajang post-filter (Min Amount: ${config.minContractAmount.toLocaleString()}): ${narajangProcessed.length} records.`);
    }

    // 3. Merge New Data
    let mergedNew = [...whobuildsProcessed, ...narajangProcessed];
    mergedNew = mergedNew.filter(p => {
      const bFloor = p["지하층수"] === "" ? null : Number(p["지하층수"]);
      const gFloor = p["지상층수"] === "" ? null : Number(p["지상층수"]);
      const bOk = bFloor === null || bFloor < 10;
      const gOk = gFloor === null || gFloor < 100;
      return bOk && gOk;
    });

    this.log(`Combined and Validated New Data: ${mergedNew.length} records.`);

    // 4. Handle Master / Deduplication
    let existingMaster: ConstructionProject[] = [];
    if (masterFile) {
      this.log(`Reading Master file: ${masterFile.name}`);
      const rawMaster = await this.readExcel(masterFile);
      existingMaster = rawMaster as ConstructionProject[];
      this.log(`Existing Master contains ${existingMaster.length} records.`);
    }

    const keyCols: (keyof ConstructionProject)[] = ['공사명', '발주(수요처)', '시공사', '주소'];
    const duplicates: ConstructionProject[] = [];
    const uniqueNew: ConstructionProject[] = [];

    mergedNew.forEach(newItem => {
      const isDuplicate = existingMaster.some(masterItem => 
        keyCols.every(key => {
          const newV = String(newItem[key] || "").trim();
          const oldV = String(masterItem[key] || "").trim();
          return newV === oldV;
        })
      );
      if (isDuplicate) duplicates.push(newItem);
      else uniqueNew.push(newItem);
    });

    this.log(`Deduplication: ${duplicates.length} dups, ${uniqueNew.length} unique.`);

    const dateTag = format(new Date(), 'yyyyMMdd');
    const resultDf = uniqueNew.map((p, i) => ({ ...p, "No.": i + 1 }));
    const updatedMaster = [...existingMaster, ...uniqueNew].map((p, i) => {
      const { "No.": _, ...rest } = p as any;
      return { "No.": i + 1, ...rest };
    });

    this.log(`Final Master size: ${updatedMaster.length}.`, "success");
    return { resultDf, duplicates, updatedMaster, dateTag, chunkSize: config.chunkSize };
  }

  async readExcel(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        resolve(XLSX.utils.sheet_to_json(sheet));
      };
      reader.onerror = reject;
      reader.readAsBinaryString(file);
    });
  }

  exportExcel(data: any[], fileName: string) {
    const ws = XLSX.utils.json_to_sheet(data, { header: COLUMNS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, fileName);
  }
}
