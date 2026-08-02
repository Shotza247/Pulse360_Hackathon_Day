"use client";
import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";

// /employees/[id]/edit → redirect to /employees/[id]
export default function EmployeeEditRedirect() {
  const router = useRouter();
  const params = useParams();
  useEffect(() => {
    router.replace(`/employees/${params.id}`);
  }, []);
  return null;
}
