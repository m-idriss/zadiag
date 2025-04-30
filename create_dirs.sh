#!/bin/bash

# Fonction pour créer les répertoires nécessaires
create_dirs() {
    mkdir -p "$1"
    echo "Répertoire créé : $1"
}

# Créer les répertoires de base
create_dirs "lib/core/constants"
create_dirs "lib/core/utils"
create_dirs "lib/shared/components"
create_dirs "lib/shared/models"
create_dirs "lib/features/auth/screens"
create_dirs "lib/features/diag/screens"
create_dirs "lib/features/profile/screens"
create_dirs "lib/features/settings/screens"
create_dirs "lib/features/notifications/screens"

echo "Création des répertoires terminée !"
