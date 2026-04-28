import PhotosUI
import SwiftUI

private enum AppTab: String, CaseIterable {
    case looks = "Looks"
    case upload = "Upload"
    case closet = "Schrank"
    case profile = "Profil"
}

private struct ClothingDraft {
    var name = ""
    var category = "Top"
    var color = ""
    var seasons = ["Fruehling", "Sommer", "Herbst", "Winter"]
    var temperature = "all"
    var occasions = ["Alltag"]
    var styles = ["minimal"]
}

private struct ProfileDraft {
    var displayName = ""
    var bio = ""
    var clearAvatar = false
    var avatarData: Data?
}

private struct RecommendationResult {
    var title: String
    var reason: String
    var items: [WardrobeItem]
    var weatherSnapshot: WeatherSnapshot
    var occasion: String
}

struct RootView: View {
    @EnvironmentObject private var model: AppModel

    @State private var tab: AppTab = .upload
    @State private var authMode: AuthMode = .signUp
    @State private var displayName = ""
    @State private var username = ""
    @State private var password = ""
    @State private var manualTemperature = ""
    @State private var selectedOccasion = "Alltag"
    @State private var selectedVibe = "clean"
    @State private var clothingDraft = ClothingDraft()
    @State private var outfitRecommendation: RecommendationResult?
    @State private var clothingImageData: Data?
    @State private var profileDraft = ProfileDraft()
    @State private var profilePickerItem: PhotosPickerItem?
    @State private var clothingPickerItem: PhotosPickerItem?
    @State private var isCameraPresented = false
    @State private var serverURLDraft = ""
    @State private var commentDrafts: [String: String] = [:]
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if model.isBootstrapping {
                loadingView
            } else if model.session.authenticated {
                authenticatedView
            } else {
                authView
            }
        }
        .background(AppPalette.background.ignoresSafeArea())
        .sheet(isPresented: $isCameraPresented) {
            CameraPicker(imageData: $clothingImageData, isPresented: $isCameraPresented)
        }
        .onAppear {
            if serverURLDraft.isEmpty {
                serverURLDraft = model.serverBaseURL
            }
        }
        .onChange(of: model.session.user?.id) { _ in
            profileDraft = ProfileDraft(
                displayName: model.session.user?.displayName ?? "",
                bio: model.session.user?.bio ?? "",
                clearAvatar: false,
                avatarData: nil
            )
        }
        .onChange(of: model.serverBaseURL) { value in
            serverURLDraft = value
        }
        .task(id: clothingPickerItem) {
            if let data = try? await clothingPickerItem?.loadTransferable(type: Data.self) {
                clothingImageData = data
            }
        }
        .task(id: profilePickerItem) {
            if let data = try? await profilePickerItem?.loadTransferable(type: Data.self) {
                profileDraft.avatarData = data
                profileDraft.clearAvatar = false
            }
        }
        .alert("Hinweis", isPresented: Binding(get: {
            errorMessage != nil
        }, set: { newValue in
            if !newValue { errorMessage = nil }
        })) {
            Button("OK", role: .cancel) {
                errorMessage = nil
            }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private var loadingView: some View {
        VStack(spacing: 14) {
            ProgressView()
                .tint(.white)
            Text("Kleiderschrank startet...")
                .foregroundStyle(AppPalette.textSecondary)
        }
    }

    private var authView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("KLEIDERSCHRANK")
                        .font(.system(size: 12, weight: .bold))
                        .tracking(1.2)
                        .foregroundStyle(AppPalette.textSecondary)
                    Text("Eine native iPhone-App fuer deinen Style.")
                        .font(.system(size: 30, weight: .bold))
                        .foregroundStyle(AppPalette.textPrimary)
                    Text("Fotografiere Kleidung, speichere Outfits und nutze wetterbasierte Vorschlaege in einem klaren anthrazit-weissen Interface.")
                        .font(.system(size: 15))
                        .foregroundStyle(AppPalette.textSecondary)
                }

                AppSectionCard(eyebrow: authMode == .signUp ? "Registrierung" : "Login", title: authMode == .signUp ? "Account anlegen" : "Einloggen", light: true) {
                    HStack(spacing: 8) {
                        Button {
                            authMode = .signUp
                        } label: {
                            PillView(title: "Registrieren", selected: authMode == .signUp, light: true)
                        }
                        Button {
                            authMode = .login
                        } label: {
                            PillView(title: "Login", selected: authMode == .login, light: true)
                        }
                    }

                    if authMode == .signUp {
                        textField("Anzeigename", text: $displayName, light: true)
                    }

                    textField("Benutzername", text: $username, light: true)
                    SecureField("Passwort", text: $password)
                        .textFieldStyle(AuthInputStyle(light: true))

                    Button(model.busyKey == "auth" ? "Bitte warten..." : authMode == .signUp ? "Account erstellen" : "Einloggen") {
                        Task {
                            await handleAuth()
                        }
                    }
                    .buttonStyle(AppButtonStyle(primary: true))
                }

                serverSettingsCard(light: true)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 24)
        }
    }

    private var authenticatedView: some View {
        VStack(spacing: 0) {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 18) {
                    headerView
                    currentTabView
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 120)
            }
        }
        .safeAreaInset(edge: .bottom) {
            bottomTabs
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 12)
                .background(.clear)
        }
    }

    private var headerView: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("KLEIDERSCHRANK")
                    .font(.system(size: 12, weight: .bold))
                    .tracking(1.2)
                    .foregroundStyle(AppPalette.textSecondary)
                Text("Closet Studio")
                    .font(.system(size: 30, weight: .bold))
                    .foregroundStyle(AppPalette.textPrimary)
                Text("Professionell organisiert fuer iPhone")
                    .font(.system(size: 13))
                    .foregroundStyle(AppPalette.textSecondary)
            }

            HStack(spacing: 12) {
                avatarView(url: model.session.user?.avatarUrl)
                    .frame(width: 44, height: 44)
                VStack(alignment: .leading, spacing: 3) {
                    Text(model.session.user?.displayName ?? "Dein Profil")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(AppPalette.textPrimary)
                    Text("@\(model.session.user?.username ?? "")")
                        .font(.system(size: 13))
                        .foregroundStyle(AppPalette.textSecondary)
                }
            }
        }
    }

    @ViewBuilder
    private var currentTabView: some View {
        switch tab {
        case .looks:
            looksView
        case .upload:
            uploadView
        case .closet:
            closetView
        case .profile:
            profileView
        }
    }

    private var looksView: some View {
        VStack(spacing: 18) {
            AppSectionCard(eyebrow: "Heute", title: "Atelier fuer deinen Tageslook") {
                if let current = model.weather?.current {
                    Text("\(Int(current.temperature_2m.rounded())) Grad · \(model.weatherLabel(for: current.weather_code))")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(AppPalette.textPrimary)
                    Text("Gefuehlt wie \(Int(current.apparent_temperature.rounded())) Grad bei \(Int(current.wind_speed_10m.rounded())) km/h Wind.")
                        .font(.system(size: 13))
                        .foregroundStyle(AppPalette.textSecondary)
                } else {
                    Text("Noch kein Wetter geladen. Du kannst die Temperatur auch manuell eintragen.")
                        .font(.system(size: 15))
                        .foregroundStyle(AppPalette.textSecondary)
                }

                Button(model.busyKey == "weather" ? "Laedt..." : "Wetter abrufen") {
                    Task {
                        do {
                            try await model.loadWeather()
                        } catch {
                            errorMessage = error.localizedDescription
                        }
                    }
                }
                .buttonStyle(AppButtonStyle(primary: true))

                textField("Temperatur manuell, z. B. 18", text: $manualTemperature)
                    .keyboardType(.numberPad)
            }

            AppSectionCard(eyebrow: "Empfehlung", title: "Outfit Engine") {
                selectionRow(title: "Anlass", values: ["Alltag", "Office", "Date", "Sport", "Party"], selection: $selectedOccasion)
                selectionRow(title: "Vibe", values: ["clean", "bold", "cozy", "polished"], selection: $selectedVibe)

                Button("Outfit vorschlagen") {
                    outfitRecommendation = recommendOutfit()
                    if outfitRecommendation == nil {
                        errorMessage = "Es fehlen passende Teile fuer diesen Look."
                    }
                }
                .buttonStyle(AppButtonStyle(primary: true))

                if let recommendation = outfitRecommendation {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(recommendation.title)
                            .font(.system(size: 18, weight: .bold))
                            .foregroundStyle(AppPalette.textPrimary)
                        Text(recommendation.reason)
                            .font(.system(size: 15))
                            .foregroundStyle(AppPalette.textSecondary)

                        ForEach(recommendation.items) { item in
                            wardrobeMiniCard(item)
                        }

                        Button(model.busyKey == "saveOutfit" ? "Speichert..." : "Outfit speichern") {
                            Task {
                                do {
                                    try await model.saveOutfit(
                                        name: recommendation.title,
                                        caption: recommendation.reason,
                                        itemIds: recommendation.items.map(\.id),
                                        occasion: recommendation.occasion,
                                        weatherSnapshot: recommendation.weatherSnapshot
                                    )
                                    tab = .closet
                                } catch {
                                    errorMessage = error.localizedDescription
                                }
                            }
                        }
                        .buttonStyle(AppButtonStyle(primary: false))
                    }
                }
            }

            AppSectionCard(eyebrow: "Community", title: "Profile entdecken") {
                if model.session.featuredProfiles.isEmpty {
                    Text("Sobald Nutzer ihre Looks teilen, erscheinen die ersten Profile hier.")
                        .font(.system(size: 14))
                        .foregroundStyle(AppPalette.textSecondary)
                } else {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(model.session.featuredProfiles) { profile in
                                Button {
                                    Task {
                                        do {
                                            try await model.loadPublicProfile(username: profile.username)
                                            tab = .profile
                                        } catch {
                                            errorMessage = error.localizedDescription
                                        }
                                    }
                                } label: {
                                    VStack(spacing: 8) {
                                        avatarView(url: profile.avatarUrl)
                                            .frame(width: 58, height: 58)
                                        Text(profile.displayName)
                                            .font(.system(size: 14, weight: .bold))
                                            .foregroundStyle(AppPalette.textPrimary)
                                        Text("@\(profile.username)")
                                            .font(.system(size: 12))
                                            .foregroundStyle(AppPalette.textSecondary)
                                    }
                                    .frame(width: 122)
                                    .padding(14)
                                    .background(AppPalette.backgroundElevated)
                                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 22, style: .continuous)
                                            .stroke(AppPalette.border, lineWidth: 1)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            AppSectionCard(eyebrow: "Feed", title: "Geteilte Outfits") {
                if model.session.sharedOutfits.isEmpty {
                    Text("Noch keine geteilten Looks.")
                        .font(.system(size: 14))
                        .foregroundStyle(AppPalette.textSecondary)
                } else {
                    VStack(spacing: 12) {
                        ForEach(model.session.sharedOutfits) { post in
                            feedCard(post, condensed: false)
                        }
                    }
                }
            }
        }
    }

    private var uploadView: some View {
        VStack(spacing: 18) {
            AppSectionCard(eyebrow: "Upload Studio", title: "Kleidung fotografieren", light: true) {
                ZStack(alignment: .bottomLeading) {
                    if let imageData = clothingImageData, let image = UIImage(data: imageData) {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFill()
                            .frame(height: 256)
                            .frame(maxWidth: .infinity)
                            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                    } else {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Bereit fuer dein naechstes Kleidungsstueck")
                                .font(.system(size: 22, weight: .bold))
                                .foregroundStyle(AppPalette.textDark)
                            Text("Nimm direkt ein Foto auf oder waehle ein Bild aus deiner Galerie.")
                                .font(.system(size: 15))
                                .foregroundStyle(Color.gray)
                        }
                        .frame(maxWidth: .infinity, minHeight: 236, alignment: .bottomLeading)
                        .padding(22)
                        .background(Color(red: 0.92, green: 0.92, blue: 0.90))
                        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                    }
                }

                HStack(spacing: 10) {
                    Button("Kamera") {
                        isCameraPresented = true
                    }
                    .buttonStyle(AppButtonStyle(primary: true))

                    PhotosPicker(selection: $clothingPickerItem, matching: .images) {
                        Text("Galerie")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(AppButtonStyle(primary: false))
                }
            }

            AppSectionCard(eyebrow: "Details", title: "Kleidungsstueck anlegen") {
                textField("Name, z. B. Anthrazit Overshirt", text: $clothingDraft.name)
                textField("Farbe", text: $clothingDraft.color)
                selectionRow(title: "Kategorie", values: ["Top", "Bottom", "Outerwear", "Shoes", "Accessory", "Dress"], selection: $clothingDraft.category)
                multiSelectionRow(title: "Jahreszeiten", values: ["Fruehling", "Sommer", "Herbst", "Winter"], selection: $clothingDraft.seasons)
                selectionRow(title: "Temperaturbereich", values: ["cold", "mild", "warm", "all"], selection: $clothingDraft.temperature)
                multiSelectionRow(title: "Anlass", values: ["Alltag", "Office", "Date", "Sport", "Party"], selection: $clothingDraft.occasions)
                multiSelectionRow(title: "Stile", values: ["minimal", "streetwear", "tailored", "elevated", "cozy", "bold", "sporty", "romantic"], selection: $clothingDraft.styles)

                Button(model.busyKey == "upload" ? "Speichert..." : "Kleidungsstueck speichern") {
                    Task {
                        guard let clothingImageData else {
                            errorMessage = "Bitte fotografiere zuerst das Kleidungsstueck oder waehle ein Bild aus."
                            return
                        }

                        do {
                            try await model.uploadWardrobe(
                                name: clothingDraft.name,
                                category: clothingDraft.category,
                                color: clothingDraft.color,
                                seasons: clothingDraft.seasons,
                                temperature: clothingDraft.temperature,
                                occasions: clothingDraft.occasions,
                                styles: clothingDraft.styles,
                                imageData: clothingImageData
                            )

                            clothingDraft = ClothingDraft()
                            self.clothingImageData = nil
                            tab = .closet
                        } catch {
                            errorMessage = error.localizedDescription
                        }
                    }
                }
                .buttonStyle(AppButtonStyle(primary: true))
            }
        }
    }

    private var closetView: some View {
        VStack(spacing: 18) {
            AppSectionCard(eyebrow: "Gespeichert", title: "Deine Outfits") {
                if model.session.savedOutfits.isEmpty {
                    Text("Hier erscheinen deine gespeicherten Outfits.")
                        .font(.system(size: 14))
                        .foregroundStyle(AppPalette.textSecondary)
                } else {
                    VStack(spacing: 12) {
                        ForEach(model.session.savedOutfits) { outfit in
                            VStack(alignment: .leading, spacing: 10) {
                                Text(outfit.name)
                                    .font(.system(size: 18, weight: .bold))
                                    .foregroundStyle(AppPalette.textPrimary)
                                Text(savedOutfitSubtitle(outfit))
                                    .font(.system(size: 13))
                                    .foregroundStyle(AppPalette.textSecondary)
                                Text(outfit.caption.isEmpty ? "Kein Text hinterlegt." : outfit.caption)
                                    .font(.system(size: 15))
                                    .foregroundStyle(AppPalette.textPrimary)

                                ForEach(outfit.items) { item in
                                    wardrobeMiniCard(item)
                                }

                                HStack(spacing: 10) {
                                    Button("Teilen") {
                                        Task {
                                            do {
                                                try await model.shareOutfit(outfit.id)
                                                tab = .looks
                                            } catch {
                                                errorMessage = error.localizedDescription
                                            }
                                        }
                                    }
                                    .buttonStyle(AppButtonStyle(primary: false))

                                    Button("Loeschen") {
                                        Task {
                                            do {
                                                try await model.deleteOutfit(outfit.id)
                                            } catch {
                                                errorMessage = error.localizedDescription
                                            }
                                        }
                                    }
                                    .buttonStyle(AppButtonStyle(primary: false))
                                }
                            }
                            .padding(14)
                            .background(AppPalette.backgroundElevated)
                            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 22, style: .continuous)
                                    .stroke(AppPalette.border, lineWidth: 1)
                            )
                        }
                    }
                }
            }

            AppSectionCard(eyebrow: "Schrank", title: "Deine Teile") {
                if model.session.wardrobe.isEmpty {
                    Text("Noch keine Kleidungsstuecke gespeichert.")
                        .font(.system(size: 14))
                        .foregroundStyle(AppPalette.textSecondary)
                } else {
                    VStack(spacing: 12) {
                        ForEach(model.session.wardrobe) { item in
                            VStack(alignment: .leading, spacing: 10) {
                                remoteImage(url: item.image)
                                    .frame(height: 220)
                                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                                Text(item.name)
                                    .font(.system(size: 18, weight: .bold))
                                    .foregroundStyle(AppPalette.textPrimary)
                                Text(wardrobeItemSubtitle(item))
                                    .font(.system(size: 13))
                                    .foregroundStyle(AppPalette.textSecondary)
                                Text(wardrobeItemTags(item))
                                    .font(.system(size: 14))
                                    .foregroundStyle(AppPalette.textPrimary)
                                Button("Loeschen") {
                                    Task {
                                        do {
                                            try await model.deleteWardrobeItem(item.id)
                                        } catch {
                                            errorMessage = error.localizedDescription
                                        }
                                    }
                                }
                                .buttonStyle(AppButtonStyle(primary: false))
                            }
                            .padding(14)
                            .background(AppPalette.backgroundElevated)
                            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 22, style: .continuous)
                                    .stroke(AppPalette.border, lineWidth: 1)
                            )
                        }
                    }
                }
            }
        }
    }

    private var profileView: some View {
        VStack(spacing: 18) {
            AppSectionCard(eyebrow: "Profil", title: "Dein Account") {
                HStack(spacing: 14) {
                    if let avatarData = profileDraft.avatarData, let image = UIImage(data: avatarData) {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 72, height: 72)
                            .clipShape(Circle())
                    } else {
                        avatarView(url: profileDraft.clearAvatar ? "" : model.session.user?.avatarUrl)
                            .frame(width: 72, height: 72)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text(model.session.user?.displayName ?? "")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundStyle(AppPalette.textPrimary)
                        Text("@\(model.session.user?.username ?? "")")
                            .font(.system(size: 13))
                            .foregroundStyle(AppPalette.textSecondary)
                    }
                }

                HStack(spacing: 10) {
                    MetricBadge(value: model.session.user?.stats?.wardrobeItems ?? 0, label: "Teile")
                    MetricBadge(value: model.session.user?.stats?.sharedOutfits ?? 0, label: "Looks")
                    MetricBadge(value: model.session.user?.stats?.followers ?? 0, label: "Follower")
                }

                textField("Anzeigename", text: $profileDraft.displayName)
                textField("Bio", text: $profileDraft.bio)

                HStack(spacing: 10) {
                    PhotosPicker(selection: $profilePickerItem, matching: .images) {
                        Text("Avatar waehlen")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(AppButtonStyle(primary: false))

                    Button("Avatar entfernen") {
                        profileDraft.clearAvatar = true
                        profileDraft.avatarData = nil
                    }
                    .buttonStyle(AppButtonStyle(primary: false))
                }

                HStack(spacing: 10) {
                    Button(model.busyKey == "profile" ? "Speichert..." : "Profil speichern") {
                        Task {
                            do {
                                try await model.saveProfile(
                                    displayName: profileDraft.displayName,
                                    bio: profileDraft.bio,
                                    avatarData: profileDraft.avatarData,
                                    clearAvatar: profileDraft.clearAvatar
                                )
                            } catch {
                                errorMessage = error.localizedDescription
                            }
                        }
                    }
                    .buttonStyle(AppButtonStyle(primary: true))

                    Button("Logout") {
                        Task {
                            await model.logout()
                        }
                    }
                    .buttonStyle(AppButtonStyle(primary: false))
                }
            }

            serverSettingsCard(light: false)

            AppSectionCard(eyebrow: "Community", title: "Ausgewaehltes Profil") {
                if let viewedProfile = model.viewedProfile {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(spacing: 14) {
                            avatarView(url: viewedProfile.profile.avatarUrl)
                                .frame(width: 72, height: 72)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(viewedProfile.profile.displayName)
                                    .font(.system(size: 18, weight: .bold))
                                    .foregroundStyle(AppPalette.textPrimary)
                                Text("@\(viewedProfile.profile.username)")
                                    .font(.system(size: 13))
                                    .foregroundStyle(AppPalette.textSecondary)
                            }
                        }

                        Text(viewedProfile.profile.bio.isEmpty ? "Kein Profiltext hinterlegt." : viewedProfile.profile.bio)
                            .font(.system(size: 15))
                            .foregroundStyle(AppPalette.textPrimary)
                        Text(profileStatsLine(viewedProfile.profile.stats))
                            .font(.system(size: 13))
                            .foregroundStyle(AppPalette.textSecondary)

                        if !viewedProfile.profile.isCurrentUser {
                            Button(viewedProfile.profile.isFollowing ? "Entfolgen" : "Folgen") {
                                Task {
                                    do {
                                        try await model.toggleFollow(
                                            userId: viewedProfile.profile.id,
                                            refreshUsername: viewedProfile.profile.username
                                        )
                                    } catch {
                                        errorMessage = error.localizedDescription
                                    }
                                }
                            }
                            .buttonStyle(AppButtonStyle(primary: false))
                        }

                        VStack(spacing: 12) {
                            ForEach(viewedProfile.sharedOutfits) { post in
                                feedCard(post, condensed: true)
                            }
                        }
                    }
                } else {
                    Text("Waehle im Feed oder in den entdeckbaren Profilen jemanden aus.")
                        .font(.system(size: 14))
                        .foregroundStyle(AppPalette.textSecondary)
                }
            }
        }
    }

    private var bottomTabs: some View {
        HStack(spacing: 8) {
            ForEach(AppTab.allCases, id: \.self) { currentTab in
                Button {
                    tab = currentTab
                } label: {
                    Text(currentTab.rawValue)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(tab == currentTab ? AppPalette.textDark : AppPalette.textSecondary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(tab == currentTab ? AppPalette.lightCard : AppPalette.panel)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
            }
        }
        .padding(8)
        .background(AppPalette.backgroundElevated)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(AppPalette.border, lineWidth: 1)
        )
    }

    private func handleAuth() async {
        do {
            if authMode == .signUp {
                try await model.signUp(
                    displayName: displayName,
                    username: username,
                    password: password
                )
            } else {
                try await model.login(username: username, password: password)
            }

            displayName = ""
            username = ""
            password = ""
            tab = .upload
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func recommendOutfit() -> RecommendationResult? {
        let wardrobe = model.session.wardrobe
        guard !wardrobe.isEmpty else { return nil }

        let temperature = Double(manualTemperature) ?? model.weather?.current.temperature_2m ?? 18
        let weatherCode = model.weather?.current.weather_code ?? 1
        let weatherLabel = model.weatherLabel(for: weatherCode)
        let season = seasonForTemperature(temperature)
        let bucket = temperatureBucket(temperature)
        let targetStyles = Array(Set((occasionStyleMap[selectedOccasion] ?? []) + (vibeStyleMap[selectedVibe] ?? [])))

        struct Context {
            let occasion: String
            let temperature: Double
            let weatherLabel: String
            let season: String
            let bucket: String
            let targetStyles: [String]
        }

        let context = Context(
            occasion: selectedOccasion,
            temperature: temperature,
            weatherLabel: weatherLabel,
            season: season,
            bucket: bucket,
            targetStyles: targetStyles
        )

        func colorFamily(_ color: String) -> String {
            let value = color.lowercased()
            if ["black", "schwarz", "white", "weiss", "grau", "gray", "grey", "creme", "silver"].contains(where: value.contains) {
                return "neutral"
            }
            if ["navy", "blau", "blue", "teal", "mint", "green", "gruen"].contains(where: value.contains) {
                return "cool"
            }
            if ["brown", "braun", "beige", "camel", "khaki", "olive"].contains(where: value.contains) {
                return "earth"
            }
            if ["red", "rot", "orange", "yellow", "gelb", "pink", "burgundy"].contains(where: value.contains) {
                return "warm"
            }
            return "neutral"
        }

        func compatibility(_ first: String, _ second: String) -> Int {
            let familyA = colorFamily(first)
            let familyB = colorFamily(second)
            if familyA == familyB { return 10 }
            if familyA == "neutral" || familyB == "neutral" { return 8 }
            if (familyA == "earth" && familyB == "warm") || (familyA == "warm" && familyB == "earth") { return 7 }
            return 4
        }

        func styleOverlap(_ item: WardrobeItem, _ targetStyles: [String]) -> Int {
            item.styles.filter(targetStyles.contains).count
        }

        func score(_ item: WardrobeItem, category: String, selected: [WardrobeItem]) -> Int {
            var value = 0
            if item.category == category { value += 50 }
            if item.occasions.contains(context.occasion) { value += 18 }
            if item.seasons.contains(context.season) { value += 12 }
            if item.temperature == context.bucket || item.temperature == "all" { value += 14 }
            value += styleOverlap(item, context.targetStyles) * 12

            if let maxCompatibility = selected.map({ compatibility($0.color, item.color) }).max() {
                value += maxCompatibility
            }

            if context.weatherLabel == "Regnerisch" && item.category == "Outerwear" { value += 10 }
            if context.weatherLabel == "Schnee" && ["Outerwear", "Shoes"].contains(item.category) { value += 14 }
            if context.bucket == "cold" && ["Outerwear", "Accessory"].contains(item.category) { value += 8 }
            if context.occasion == "Party" && colorFamily(item.color) != "neutral" { value += 6 }
            return value
        }

        func bestItem(for category: String, selected: [WardrobeItem]) -> WardrobeItem? {
            wardrobe
                .filter { $0.category == category }
                .max { score($0, category: category, selected: selected) < score($1, category: category, selected: selected) }
        }

        var selectedItems: [WardrobeItem] = []

        if let top = bestItem(for: "Top", selected: selectedItems) {
            selectedItems.append(top)
        }
        if let bottom = bestItem(for: "Bottom", selected: selectedItems) {
            selectedItems.append(bottom)
        }
        if let shoes = bestItem(for: "Shoes", selected: selectedItems) {
            selectedItems.append(shoes)
        }
        if context.bucket == "cold" || ["Regnerisch", "Schnee"].contains(context.weatherLabel) {
            if let outerwear = bestItem(for: "Outerwear", selected: selectedItems) {
                selectedItems.append(outerwear)
            }
        }
        if context.bucket != "warm" || context.occasion == "Party" {
            if let accessory = bestItem(for: "Accessory", selected: selectedItems) {
                selectedItems.append(accessory)
            }
        }

        guard !selectedItems.isEmpty else { return nil }

        let primaryStyle = selectedItems
            .flatMap(\.styles)
            .reduce(into: [:]) { counts, style in counts[style, default: 0] += 1 }
            .max { $0.value < $1.value }?.key ?? "minimal"

        let primaryColor = selectedItems
            .map(\.color)
            .map(colorFamily)
            .reduce(into: [:]) { counts, color in counts[color, default: 0] += 1 }
            .max { $0.value < $1.value }?.key ?? "neutral"

        return RecommendationResult(
            title: "\(selectedOccasion)-Look im \(selectedVibe)-Vibe",
            reason: "Der Vorschlag kombiniert \(selectedOccasion.lowercased())-Teile, \(primaryStyle)-Stil und eine \(primaryColor)-nahe Farbpalette fuer \(Int(temperature.rounded())) Grad bei \(weatherLabel).",
            items: selectedItems,
            weatherSnapshot: WeatherSnapshot(temperature: temperature, weatherLabel: weatherLabel),
            occasion: selectedOccasion
        )
    }

    private func seasonForTemperature(_ value: Double) -> String {
        if value < 10 { return "Winter" }
        if value < 18 { return "Fruehling" }
        if value < 24 { return "Herbst" }
        return "Sommer"
    }

    private func temperatureBucket(_ value: Double) -> String {
        if value < 10 { return "cold" }
        if value <= 20 { return "mild" }
        return "warm"
    }

    private var occasionStyleMap: [String: [String]] {
        [
            "Alltag": ["minimal", "streetwear", "cozy"],
            "Date": ["elevated", "romantic", "minimal"],
            "Office": ["tailored", "minimal", "elevated"],
            "Party": ["bold", "elevated", "streetwear"],
            "Sport": ["sporty", "cozy"],
        ]
    }

    private var vibeStyleMap: [String: [String]] {
        [
            "bold": ["bold", "streetwear", "elevated"],
            "clean": ["minimal", "tailored"],
            "cozy": ["cozy", "romantic"],
            "polished": ["tailored", "elevated", "minimal"],
        ]
    }

    private func selectionRow(title: String, values: [String], selection: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(AppPalette.textPrimary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(values, id: \.self) { value in
                        Button {
                            selection.wrappedValue = value
                        } label: {
                            PillView(title: value, selected: selection.wrappedValue == value, light: false)
                        }
                    }
                }
            }
        }
    }

    private func multiSelectionRow(title: String, values: [String], selection: Binding<[String]>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(AppPalette.textPrimary)
            FlowLayout(values, spacing: 8) { value in
                Button {
                    if selection.wrappedValue.contains(value) {
                        selection.wrappedValue.removeAll(where: { $0 == value })
                    } else {
                        selection.wrappedValue.append(value)
                    }
                } label: {
                    PillView(title: value, selected: selection.wrappedValue.contains(value), light: false)
                }
            }
        }
    }

    private func feedCard(_ post: SharedPost, condensed: Bool) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            feedCardHeader(post)

            Text(post.outfitName)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(AppPalette.textPrimary)
            Text(post.caption.isEmpty ? "Ohne Caption." : post.caption)
                .font(.system(size: 15))
                .foregroundStyle(AppPalette.textPrimary)
            Text(sharedPostWeatherLine(post))
                .font(.system(size: 13))
                .foregroundStyle(AppPalette.textSecondary)

            ForEach(post.previewItems) { item in
                wardrobeMiniCard(item)
            }

            Button("\(post.likedByViewer ? "Unlike" : "Like") · \(post.likes)") {
                Task {
                    do {
                        try await model.toggleLike(postId: post.id, refreshUsername: post.author.username)
                    } catch {
                        errorMessage = error.localizedDescription
                    }
                }
            }
            .buttonStyle(AppButtonStyle(primary: false))

            if !condensed {
                commentComposer(post)
                commentsSection(post)
            }
        }
        .padding(16)
        .background(AppPalette.backgroundElevated)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(AppPalette.border, lineWidth: 1)
        )
    }

    private func textField(_ title: String, text: Binding<String>, light: Bool = false) -> some View {
        TextField(title, text: text)
            .textFieldStyle(AuthInputStyle(light: light))
    }

    private func serverSettingsCard(light: Bool) -> some View {
        AppSectionCard(eyebrow: "Server", title: "API-Verbindung", light: light) {
            Text(model.isUsingPlaceholderServer ? "Noch keine Live-API verbunden. Trage hier deine echte URL ein." : "Aktuell verbunden mit \(model.serverBaseURL)")
                .font(.system(size: 14))
                .foregroundStyle(light ? Color.gray : AppPalette.textSecondary)

            textField("https://deine-api-url.de", text: $serverURLDraft, light: light)
                .keyboardType(.URL)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled(true)

            HStack(spacing: 10) {
                Button("Server speichern") {
                    do {
                        try model.updateServerBaseURL(serverURLDraft)
                        serverURLDraft = model.serverBaseURL
                        errorMessage = "Server gespeichert."
                    } catch {
                        errorMessage = error.localizedDescription
                    }
                }
                .buttonStyle(AppButtonStyle(primary: !light))

                Button("Server testen") {
                    Task {
                        do {
                            let health = try await model.pingServer()
                            errorMessage = health.ok ? "Server erreichbar." : "Server antwortet nicht korrekt."
                        } catch {
                            errorMessage = error.localizedDescription
                        }
                    }
                }
                .buttonStyle(AppButtonStyle(primary: false))
            }

            Button("Auf Standard zuruecksetzen") {
                model.resetServerBaseURL()
                serverURLDraft = model.serverBaseURL
                errorMessage = "Server auf Standard gesetzt."
            }
            .buttonStyle(AppButtonStyle(primary: false))
        }
    }

    private func feedCardHeader(_ post: SharedPost) -> some View {
        HStack(spacing: 12) {
            Button {
                Task {
                    do {
                        try await model.loadPublicProfile(username: post.author.username)
                        tab = .profile
                    } catch {
                        errorMessage = error.localizedDescription
                    }
                }
            } label: {
                HStack(spacing: 10) {
                    avatarView(url: post.author.avatarUrl)
                        .frame(width: 42, height: 42)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(post.author.displayName)
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(AppPalette.textPrimary)
                        Text("@\(post.author.username)")
                            .font(.system(size: 13))
                            .foregroundStyle(AppPalette.textSecondary)
                    }
                }
            }

            Spacer(minLength: 0)

            if post.author.id != model.session.user?.id {
                Button(post.isFollowing ? "Entfolgen" : "Folgen") {
                    Task {
                        do {
                            try await model.toggleFollow(userId: post.author.id, refreshUsername: post.author.username)
                        } catch {
                            errorMessage = error.localizedDescription
                        }
                    }
                }
                .buttonStyle(AppButtonStyle(primary: false))
                .frame(width: 120)
            }
        }
    }

    private func commentComposer(_ post: SharedPost) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            textField("Kommentar schreiben", text: commentBinding(for: post.id))

            Button("Senden") {
                Task {
                    let text = commentDrafts[post.id, default: ""]
                    guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

                    do {
                        try await model.addComment(postId: post.id, text: text, refreshUsername: post.author.username)
                        commentDrafts[post.id] = ""
                    } catch {
                        errorMessage = error.localizedDescription
                    }
                }
            }
            .buttonStyle(AppButtonStyle(primary: true))
        }
    }

    @ViewBuilder
    private func commentsSection(_ post: SharedPost) -> some View {
        if post.comments.isEmpty {
            Text("Noch keine Kommentare.")
                .font(.system(size: 13))
                .foregroundStyle(AppPalette.textSecondary)
        } else {
            VStack(spacing: 8) {
                ForEach(post.comments) { comment in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(comment.authorName)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(AppPalette.textPrimary)
                        Text(comment.text)
                            .font(.system(size: 14))
                            .foregroundStyle(AppPalette.textPrimary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .background(AppPalette.panel)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(AppPalette.border, lineWidth: 1)
                    )
                }
            }
        }
    }

    private func commentBinding(for postId: String) -> Binding<String> {
        Binding(
            get: { commentDrafts[postId] ?? "" },
            set: { commentDrafts[postId] = $0 }
        )
    }

    private func savedOutfitSubtitle(_ outfit: SavedOutfit) -> String {
        let temperature = Int((outfit.weatherSnapshot.temperature ?? 0).rounded())
        return "\(outfit.occasion) · \(temperature) Grad"
    }

    private func wardrobeItemSubtitle(_ item: WardrobeItem) -> String {
        let color = item.color.isEmpty ? "ohne Farbangabe" : item.color
        return "\(item.category) · \(color)"
    }

    private func wardrobeItemTags(_ item: WardrobeItem) -> String {
        (item.seasons + item.occasions + item.styles + [item.temperature]).joined(separator: " · ")
    }

    private func profileStatsLine(_ stats: ProfileStats) -> String {
        "\(stats.sharedOutfits) Looks · \(stats.followers) Follower · \(stats.wardrobeItems) Teile"
    }

    private func sharedPostWeatherLine(_ post: SharedPost) -> String {
        guard let snapshot = post.weatherSnapshot, let temperature = snapshot.temperature else {
            return "Ohne Wetterdaten"
        }

        let label = snapshot.weatherLabel ?? "Wetter offen"
        return "\(Int(temperature.rounded())) Grad · \(label)"
    }

    private func remoteImage(url: String) -> some View {
        Group {
            if let resolved = model.resolvedURL(for: url) {
                AsyncImage(url: resolved) { image in
                    image
                        .resizable()
                        .scaledToFill()
                } placeholder: {
                    Rectangle().fill(AppPalette.panelSoft)
                }
            } else {
                Rectangle().fill(AppPalette.panelSoft)
            }
        }
    }

    private func avatarView(url: String?) -> some View {
        Group {
            if let url, let resolved = model.resolvedURL(for: url) {
                AsyncImage(url: resolved) { image in
                    image
                        .resizable()
                        .scaledToFill()
                } placeholder: {
                    Circle().fill(AppPalette.panelSoft)
                }
            } else {
                Circle()
                    .fill(AppPalette.lightCard)
                    .overlay(
                        Image(systemName: "hanger")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(AppPalette.textDark)
                    )
            }
        }
        .clipShape(Circle())
    }

    private func wardrobeMiniCard(_ item: WardrobeItem) -> some View {
        HStack(spacing: 12) {
            remoteImage(url: item.image)
                .frame(width: 58, height: 58)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                Text(item.name)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(AppPalette.textPrimary)
                Text("\(item.category) · \(item.color.isEmpty ? "neutral" : item.color)")
                    .font(.system(size: 13))
                    .foregroundStyle(AppPalette.textSecondary)
            }

            Spacer(minLength: 0)
        }
        .padding(10)
        .background(AppPalette.panel)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(AppPalette.border, lineWidth: 1)
        )
    }
}

private enum AuthMode {
    case signUp
    case login
}

private struct AuthInputStyle: TextFieldStyle {
    let light: Bool

    func _body(configuration: TextField<_Label>) -> some View {
        configuration
            .padding(.horizontal, 14)
            .padding(.vertical, 14)
            .background(light ? Color.white : AppPalette.panelSoft)
            .foregroundStyle(light ? AppPalette.textDark : AppPalette.textPrimary)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(light ? Color.black.opacity(0.08) : AppPalette.border, lineWidth: 1)
            )
    }
}

private struct FlowLayout<Data: RandomAccessCollection, Content: View>: View where Data.Element: Hashable {
    let data: Data
    let spacing: CGFloat
    let content: (Data.Element) -> Content

    init(_ data: Data, spacing: CGFloat, @ViewBuilder content: @escaping (Data.Element) -> Content) {
        self.data = data
        self.spacing = spacing
        self.content = content
    }

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 110), spacing: spacing)], alignment: .leading, spacing: spacing) {
            ForEach(Array(data), id: \.self) { item in
                content(item)
            }
        }
    }
}
