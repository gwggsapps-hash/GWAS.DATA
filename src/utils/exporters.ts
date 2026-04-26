import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

export interface ServiceRecord {
  'id'?: string | number;
  'business_id'?: string | number;
  'Rider Name': string;
  'Bike Number': string;
  'Token / Agent': string;
  'Reading': number;
  'Date'?: string | Date;
  [key: string]: any;
}

export const downloadXLSX = (data: any[], fileName: string) => {
  if (!data || data.length === 0) return;
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  XLSX.writeFile(workbook, `${fileName}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
};

export const generateVehicleHistoryPDF = (vehicleNumber: string, history: ServiceRecord[]) => {
  const doc = new jsPDF() as any;
  const pageWidth = doc.internal.pageSize.getWidth();

  // Letterhead Header
  doc.setFillColor(200, 16, 46); // Gulf Way Red
  doc.rect(0, 0, pageWidth, 45, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('times', 'italic');
  doc.text('GULF WAY', pageWidth / 2, 22, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('AUTO SERVICE LLC', pageWidth / 2, 32, { align: 'center', charSpace: 3 });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('PROFESSIONAL AUTOMOTIVE MAINTENANCE & ANALYTICS', pageWidth / 2, 38, { align: 'center' });

  // Body Header
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(16);
  doc.setFont('times', 'bold');
  doc.text('VEHICLE SERVICE HISTORY REPORT', 20, 60);
  
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 63, pageWidth - 20, 63);

  // Info Grid
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Vehicle ID:', 20, 75);
  doc.text('Total Entries:', 100, 75);
  doc.text('Generated On:', 20, 82);
  
  doc.setFont('helvetica', 'normal');
  doc.text(vehicleNumber, 50, 75);
  doc.text(String(history.length), 130, 75);
  doc.text(format(new Date(), 'PPPP p'), 50, 82);

  const tableData = history.map(row => [
    row['Token / Agent'] || 'N/A',
    row['Rider Name'] || 'N/A',
    row['Reading'] ? `${Number(row['Reading']).toLocaleString()} KM` : '-',
    format(new Date(), 'dd/MM/yyyy') // Default date if missing
  ]);

  doc.autoTable({
    startY: 95,
    head: [['Token / Agent ID', 'Rider Name', 'Mileage Reading', 'Service Date']],
    body: tableData,
    theme: 'striped',
    headStyles: { 
      fillColor: [30, 41, 59], 
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: { font: 'helvetica', fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 40 },
      2: { halign: 'right' },
      3: { halign: 'center' }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY || 150;
  
  // Official Stamp Area
  doc.setDrawColor(200, 16, 46);
  doc.setLineWidth(0.5);
  doc.circle(pageWidth - 40, finalY + 25, 15);
  doc.setFontSize(6);
  doc.text('OFFICIAL', pageWidth - 40, finalY + 23, { align: 'center' });
  doc.text('GWAS SCAN', pageWidth - 40, finalY + 27, { align: 'center' });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Gulf Way Auto Service LLC | Technical Dept. Report | Confidential', pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

  doc.save(`GWAS_Report_${vehicleNumber}.pdf`);
};
