"use client"
import React from "react"
import { ConfigProvider, theme } from "antd"
import { AntdRegistry } from "@ant-design/nextjs-registry"

export const AntConfigProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  return (
    <AntdRegistry>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: "#c3ff49",
            fontFamily: "var(--font-sequel-sans)",
            colorText: "#fdfdff",
          },
          algorithm: theme.darkAlgorithm,
          components: {
            Button: { primaryColor: "#0b090a" },
            Input: { colorBgContainer: "transparent" },
            DatePicker: { colorBgContainer: "transparent" },
          },
        }}
      >
        {children}
      </ConfigProvider>
    </AntdRegistry>
  )
}
