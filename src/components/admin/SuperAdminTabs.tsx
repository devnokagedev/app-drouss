import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DiwaneManagement } from "@/components/DiwaneManagement"
import { PlatformAdminsPanel } from "./PlatformAdminsPanel"

export function SuperAdminTabs() {
  return (
    <Tabs defaultValue="diwanes" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="diwanes">Gestion Diwanes</TabsTrigger>
        <TabsTrigger value="admins">Admins Plateforme</TabsTrigger>
      </TabsList>
      <TabsContent value="diwanes" className="mt-4">
        <DiwaneManagement />
      </TabsContent>
      <TabsContent value="admins" className="mt-4">
        <PlatformAdminsPanel />
      </TabsContent>
    </Tabs>
  )
}

