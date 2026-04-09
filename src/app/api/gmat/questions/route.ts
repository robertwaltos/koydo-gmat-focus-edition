import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    exam: "gmat",
    message: "Questions endpoint — connect to Supabase for question bank",
    categories: ["Quantitative Reasoning","Verbal Reasoning","Data Insights"],
  });
}
