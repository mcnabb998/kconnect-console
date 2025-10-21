{{/*
Expand the name of the chart.
*/}}
{{- define "kconnect-console.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "kconnect-console.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "kconnect-console.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "kconnect-console.labels" -}}
helm.sh/chart: {{ include "kconnect-console.chart" . }}
{{ include "kconnect-console.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "kconnect-console.selectorLabels" -}}
app.kubernetes.io/name: {{ include "kconnect-console.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "kconnect-console.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "kconnect-console.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Proxy specific labels
*/}}
{{- define "kconnect-console.proxy.labels" -}}
{{ include "kconnect-console.labels" . }}
app.kubernetes.io/component: proxy
{{- end }}

{{/*
Proxy selector labels
*/}}
{{- define "kconnect-console.proxy.selectorLabels" -}}
{{ include "kconnect-console.selectorLabels" . }}
app.kubernetes.io/component: proxy
{{- end }}

{{/*
Web specific labels
*/}}
{{- define "kconnect-console.web.labels" -}}
{{ include "kconnect-console.labels" . }}
app.kubernetes.io/component: web
{{- end }}

{{/*
Web selector labels
*/}}
{{- define "kconnect-console.web.selectorLabels" -}}
{{ include "kconnect-console.selectorLabels" . }}
app.kubernetes.io/component: web
{{- end }}
