import { PDFDocument, StandardFonts, rgb, pushGraphicsState, popGraphicsState, concatTransformationMatrix } from 'pdf-lib';
import { leaderAnchor, balloonRadii, regionsOf, type Region } from './geometry';
type Annotation = { number:string;page:number;bx:number;by:number;x:number;y:number;width:number;height:number;regions:Region[] };
type PdfView = { getPage(page:number):Promise<{getViewport(options:{scale:number}):{convertToPdfPoint(x:number,y:number):number[]}}> };
/** Adds vector annotations to a copy, preserving the source PDF and its rotation/crop boxes. */
export async function createAnnotatedPdf(source:Uint8Array, zones:Annotation[], pdf:PdfView, fontSize=13):Promise<Uint8Array> {
 const doc=await PDFDocument.load(source.slice());
 const font=await doc.embedFont(StandardFonts.Helvetica),red=rgb(0.85,0.24,0.2);
 const pages=doc.getPages();
 for(let i=0;i<pages.length;i++) {
  const local=zones.filter(z=>z.page===i+1);if(!local.length)continue;
  const viewport=(await pdf.getPage(i+1)).getViewport({scale:1});
  const o=viewport.convertToPdfPoint(0,0),x=viewport.convertToPdfPoint(1,0),y=viewport.convertToPdfPoint(0,1),page=pages[i];
  // Invert the displayed viewport, using y-up drawing coordinates for upright PDF text.
  page.pushOperators(pushGraphicsState(),concatTransformationMatrix(x[0]-o[0],x[1]-o[1],o[0]-y[0],o[1]-y[1],o[0],o[1]));
  for(const z of local) {
   for(const region of regionsOf(z)) for(let k=0;k<region.points.length;k++) {
    const a=region.points[k],b=region.points[(k+1)%region.points.length];
    page.drawLine({start:{x:a.x,y:-a.y},end:{x:b.x,y:-b.y},thickness:.8,color:red});
   }
   const a=leaderAnchor(z);page.drawLine({start:{x:a.x,y:-a.y},end:{x:z.bx,y:-z.by},thickness:.8,color:red});
  }
  for(const z of local) {
   const r=balloonRadii(z.number,fontSize);
   page.drawEllipse({x:z.bx,y:-z.by,xScale:r.rx,yScale:r.ry,borderWidth:1.5,borderColor:red,color:rgb(1,1,1)});
   page.drawText(z.number,{x:z.bx-font.widthOfTextAtSize(z.number,fontSize)/2,y:-z.by-fontSize*.35,size:fontSize,font,color:red});
  }
  page.pushOperators(popGraphicsState());
 }
 return doc.save();
}
