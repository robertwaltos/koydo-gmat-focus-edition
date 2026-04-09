import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    exam: "gmat",
    message: "Dashboard endpoint — connect to Supabase for live data",
    sections: ["Quantitative Reasoning","Verbal Reasoning","Data Insights"],
  });
}
