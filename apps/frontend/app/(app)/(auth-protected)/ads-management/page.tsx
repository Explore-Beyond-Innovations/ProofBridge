import { Button } from "antd"
import { Plus } from "lucide-react"
import Link from "next/link"
import React from "react"

const AdManagementPage = () => {
  return (
    <div>
      <div className="flex items-center gap-4 justify-between flex-wrap md:p-4">
        <p className="text-3xl font-sequel">Ads Management</p>
        <Link
          href={"/ads-management/create"}
          data-tour="ads-management-create"
        >
          <Button
            size="middle"
            className="!rounded-full !h-[40px]"
            type="primary"
          >
            <Plus />
            <p>Create an Ad</p>
          </Button>
        </Link>
      </div>
    </div>
  )
}

export default AdManagementPage
