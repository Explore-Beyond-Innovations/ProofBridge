"use client"
import CreateAd from "@/components/ad-management-ui/CreateAd"
import { GoBack } from "@/components/shared/GoBack"
import { PageTourButton } from "@/components/onboarding/PageTourButton"
import React from "react"

const CreateAdPage = () => {
  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2 pr-4">
        <GoBack />
        <PageTourButton flow="create-ad" />
      </div>
      <div className="p-4">
        <CreateAd />
      </div>
    </div>
  )
}

export default CreateAdPage
