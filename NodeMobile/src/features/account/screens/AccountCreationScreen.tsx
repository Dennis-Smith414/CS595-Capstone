// src/features/account/screens/AccountCreationScreen.tsx
import React from "react";
import AccountForm from "../components/AccountForm";
import { createUser } from "../../../lib/api";

export default function AccountCreationScreen({ navigation }: { navigation: any }) {
  return (
    <AccountForm
      logoSource={require("../../../assets/images/OCLogoLight.png")}
      createUser={createUser}
      onSuccess={() => navigation.goBack()}
      onCancel={() => navigation.goBack()}
    />
  );
}
