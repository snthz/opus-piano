import type { BookGrade, BookItem, BookStage } from "@/lib/music/reading-book";
import { gradeItems } from "@/lib/music/reading-book";
import { GRADE_1 } from "./grade-1";
import { GRADE_2 } from "./grade-2";
import { GRADE_3 } from "./grade-3";
import { GRADE_4 } from "./grade-4";
import { GRADE_5 } from "./grade-5";

/** El cuaderno entero, del grado 1 al 5. */
export const READING_BOOK: BookGrade[] = [GRADE_1, GRADE_2, GRADE_3, GRADE_4, GRADE_5];

export const GRADE_BY_N: Record<number, BookGrade> = Object.fromEntries(READING_BOOK.map((g) => [g.n, g]));

export const ALL_BOOK_ITEMS: BookItem[] = READING_BOOK.flatMap(gradeItems);

export interface BookLocation {
  grade: BookGrade;
  stage: BookStage;
  item: BookItem;
}

const INDEX: Record<string, BookLocation> = {};
for (const grade of READING_BOOK) {
  for (const stage of grade.stages) {
    for (const item of stage.items) INDEX[item.id] = { grade, stage, item };
  }
}

/** Dónde está una pieza dentro del cuaderno. */
export const bookLocation = (id: string): BookLocation | undefined => INDEX[id];

/** La pieza siguiente y la anterior dentro del mismo grado, para pasar página. */
export function neighbours(id: string): { prev?: BookItem; next?: BookItem } {
  const location = INDEX[id];
  if (!location) return {};
  const list = gradeItems(location.grade);
  const i = list.findIndex((item) => item.id === id);
  return { prev: list[i - 1], next: list[i + 1] };
}
