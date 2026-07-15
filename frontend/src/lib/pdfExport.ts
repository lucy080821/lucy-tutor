import jsPDF from "jspdf";
import { toPng } from "html-to-image";

const PAGE_WIDTH = 800;
const PAGE_HEIGHT = 1131; // matches TuitionInvoice's A4-ish page size at 800px width

// Renders a DOM node (typically a hidden report component, ref'd like TuitionInvoice) to a
// multi-page PDF. Content taller than one page is split across additional pages, since practice
// reports (essays, transcripts) can run much longer than a single-page invoice.
export async function exportNodeToPDF(node: HTMLElement, filename: string) {
  const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff" });

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = dataUrl;
  });

  const imgHeight = (img.height / img.width) * PAGE_WIDTH;
  const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [PAGE_WIDTH, PAGE_HEIGHT] });

  let position = 0;
  let heightLeft = imgHeight;
  pdf.addImage(dataUrl, "PNG", 0, position, PAGE_WIDTH, imgHeight);
  heightLeft -= PAGE_HEIGHT;

  while (heightLeft > 0) {
    position -= PAGE_HEIGHT;
    pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pdf.addImage(dataUrl, "PNG", 0, position, PAGE_WIDTH, imgHeight);
    heightLeft -= PAGE_HEIGHT;
  }

  pdf.save(filename);
}
