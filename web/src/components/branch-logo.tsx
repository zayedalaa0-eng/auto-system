import React from "react";
import Image from "next/image";

export function BranchLogo({ branchName, className = "w-5 h-5" }: { branchName?: string | null, className?: string }) {
  if (!branchName) return null;

  let logoSrc = "";
  if (branchName.includes("شيري") || branchName.includes("الشيري")) {
    logoSrc = "/logos/chery.jpg";
  } else if (branchName.includes("فورثنج") || branchName.includes("فورثينج") || branchName.includes("الفورثنك")) {
    logoSrc = "/logos/forthing.jpg";
  } else if (branchName.includes("لمعلم") || branchName.includes("المعلم")) {
    logoSrc = "/logos/lemalem.jpg";
  }

  if (!logoSrc) return null;

  return (
    <Image 
      src={logoSrc} 
      alt={branchName} 
      width={24} 
      height={24} 
      className={`inline-block object-contain rounded-sm ${className}`} 
    />
  );
}
